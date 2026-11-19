alter table public.projects add column if not exists start_date date;
alter table public.projects add constraint projects_application_dates_check check (start_date is null or deadline is null or start_date <= deadline);
-- Previously dated material cards without any schedule gain exactly one stable task.
-- With no execution date in the old schema, their existing deadline is the initial execution date.
insert into public.tasks(id,user_id,title,scheduled_date,deadline,priority,category,completed,status,project_item_id,created_at)
select i.id,i.user_id,i.title,i.deadline,i.deadline,2,'취업 준비',false,'todo',i.id,i.created_at
from public.project_items i where i.deadline is not null
and not exists(select 1 from public.tasks t where t.project_item_id=i.id or t.id=i.id);

create or replace function public.save_project_work(p_item jsonb,p_task jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  owner_id uuid := auth.uid();
  saved_item public.project_items;
  saved_task public.tasks;
begin
  if owner_id is null or (p_item->>'user_id')::uuid <> owner_id or (p_task->>'user_id')::uuid <> owner_id
     or (p_task->>'project_item_id')::uuid <> (p_item->>'id')::uuid then
    raise exception 'Invalid owner or project link' using errcode='42501';
  end if;
  insert into public.project_items(id,user_id,project_id,title,stage,content,deadline,created_at)
  values((p_item->>'id')::uuid,owner_id,(p_item->>'project_id')::uuid,p_item->>'title',p_item->>'stage',coalesce(p_item->>'content',''),nullif(p_item->>'deadline','')::date,coalesce((p_item->>'created_at')::timestamptz,now()))
  on conflict(id) do update set project_id=excluded.project_id,title=excluded.title,stage=excluded.stage,content=excluded.content,deadline=excluded.deadline
  returning * into saved_item;
  insert into public.tasks(id,user_id,title,scheduled_date,deadline,priority,category,completed,status,project_item_id,deleted_at,created_at)
  values((p_task->>'id')::uuid,owner_id,p_task->>'title',(p_task->>'scheduled_date')::date,nullif(p_task->>'deadline','')::date,(p_task->>'priority')::smallint,p_task->>'category',(p_task->>'completed')::boolean,p_task->>'status',saved_item.id,nullif(p_task->>'deleted_at','')::timestamptz,coalesce((p_task->>'created_at')::timestamptz,now()))
  on conflict(id) do update set title=excluded.title,scheduled_date=excluded.scheduled_date,deadline=excluded.deadline,priority=excluded.priority,category=excluded.category,completed=excluded.completed,status=excluded.status,project_item_id=excluded.project_item_id,deleted_at=excluded.deleted_at
  returning * into saved_task;
  return jsonb_build_object('item',to_jsonb(saved_item),'task',to_jsonb(saved_task));
end $$;
revoke all on function public.save_project_work(jsonb,jsonb) from public,anon;
grant execute on function public.save_project_work(jsonb,jsonb) to authenticated;
