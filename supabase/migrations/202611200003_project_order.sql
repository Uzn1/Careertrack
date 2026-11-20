alter table public.projects add column sort_order bigint not null default 0 check(sort_order>=0);

create or replace function public.move_project(p_project_id uuid,p_order uuid[],p_archived boolean)
returns setof public.projects language plpgsql security invoker set search_path=public as $$
declare expected uuid[];
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode='42501';end if;
 perform 1 from public.projects where user_id=auth.uid() for update;
 if not exists(select 1 from public.projects where id=p_project_id and user_id=auth.uid()) then raise exception '프로젝트를 찾지 못했습니다.';end if;
 if p_archived is null or p_order is null or not(p_project_id=any(p_order)) or cardinality(p_order)<>(select count(distinct value) from unnest(p_order) value) then raise exception '프로젝트 순서가 올바르지 않습니다.';end if;
 select array_agg(id) into expected from public.projects where user_id=auth.uid() and (id=p_project_id or (archived_at is not null)=p_archived);
 if cardinality(expected)<>cardinality(p_order) or not(p_order<@expected) then raise exception '프로젝트 목록이 변경되었습니다. 새로고침 후 다시 이동해 주세요.';end if;
 update public.projects p set sort_order=o.position-1,
 archived_at=case when p.id=p_project_id then case when p_archived then coalesce(p.archived_at,now()) else null end else p.archived_at end
 from unnest(p_order) with ordinality o(id,position) where p.id=o.id and p.user_id=auth.uid();
 return query select * from public.projects where user_id=auth.uid();
end $$;
revoke all on function public.move_project(uuid,uuid[],boolean) from public,anon;
grant execute on function public.move_project(uuid,uuid[],boolean) to authenticated;
