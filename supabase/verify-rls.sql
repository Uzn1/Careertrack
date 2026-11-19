-- Run AFTER the migration in a disposable test project or SQL editor.
-- All fixture records and operations are rolled back.
begin;
insert into auth.users (id,email) values ('10000000-0000-0000-0000-000000000001','rls-a@example.test'),('10000000-0000-0000-0000-000000000002','rls-b@example.test');
insert into public.projects(id,user_id,title) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A project');
insert into public.project_items(id,user_id,project_id,stage,title) values('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','준비','A item');
insert into public.tasks(id,user_id,title,scheduled_date) values('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A task','2026-11-19');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$
declare affected integer;
begin
  if exists(select 1 from public.projects) or exists(select 1 from public.project_items) or exists(select 1 from public.tasks) then raise exception 'FAIL: other-user records visible'; end if;
  update public.tasks set title='Intrusion'; get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: other-user update allowed'; end if;
  delete from public.tasks; get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: other-user delete allowed'; end if;
  begin
    insert into public.tasks(user_id,title,scheduled_date,project_item_id) values('10000000-0000-0000-0000-000000000002','Bad link','2026-11-19','30000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: cross-owner task link allowed';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.project_items(user_id,project_id,stage,title) values('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','준비','Bad item');
    raise exception 'FAIL: cross-owner project link allowed';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.tasks(user_id,title,scheduled_date) values('10000000-0000-0000-0000-000000000001','Spoof','2026-11-19');
    raise exception 'FAIL: ownership spoof allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ begin
 if (select count(*) from public.tasks) <> 1 then raise exception 'FAIL: owner cannot see own task'; end if;
 update public.tasks set completed=true, status='done' where id='40000000-0000-0000-0000-000000000001';
 if not (select completed from public.tasks where id='40000000-0000-0000-0000-000000000001') then raise exception 'FAIL: owner update denied'; end if;
end $$;
rollback;
