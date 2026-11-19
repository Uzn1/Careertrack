-- Tasks remain owner-protected and can be restored with all links intact.
alter table public.tasks add column if not exists deleted_at timestamptz;
create index tasks_user_deleted on public.tasks(user_id,deleted_at);
