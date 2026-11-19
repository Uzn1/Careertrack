-- Apply to the existing Supabase project with its SQL editor or Supabase CLI.
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Seoul' check (timezone in ('Asia/Seoul','Asia/Tokyo','America/New_York','America/Los_Angeles','Europe/London','UTC')),
  display_name text not null default '' check (char_length(display_name) <= 80)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  company text not null default '' check (char_length(company) <= 200),
  deadline date,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null,
  stage text not null check (stage in ('준비','진행','마감')),
  title text not null check (char_length(trim(title)) between 1 and 200),
  content text not null default '' check (char_length(content) <= 20000),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (project_id, user_id) references public.projects(id, user_id) on delete cascade
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  scheduled_date date not null,
  deadline date,
  priority smallint not null default 2 check (priority between 1 and 3),
  category text not null default '취업 준비' check (char_length(trim(category)) between 1 and 40),
  completed boolean not null default false,
  project_item_id uuid,
  created_at timestamptz not null default now(),
  foreign key (project_item_id, user_id) references public.project_items(id, user_id)
);
create index tasks_user_date on public.tasks(user_id, scheduled_date, priority, created_at);
create index items_user_project on public.project_items(user_id, project_id);
create index projects_user on public.projects(user_id);
alter table public.user_settings enable row level security;
alter table public.projects enable row level security;
alter table public.project_items enable row level security;
alter table public.tasks enable row level security;
create policy own_settings on public.user_settings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_projects on public.projects for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_items on public.project_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_tasks on public.tasks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.user_settings, public.projects, public.project_items, public.tasks from anon;
grant select, insert, update, delete on public.user_settings, public.projects, public.project_items, public.tasks to authenticated;
