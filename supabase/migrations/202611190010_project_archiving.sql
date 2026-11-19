alter table public.projects add column if not exists archived_at timestamptz;
create index projects_user_archived on public.projects(user_id,archived_at);
