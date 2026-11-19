-- Keep existing completed tasks completed when introducing the progress board.
alter table public.tasks add column if not exists status text not null default 'todo';
update public.tasks set status = case when completed then 'done' when status = 'in_progress' then 'in_progress' else 'todo' end;
alter table public.tasks add constraint tasks_status_check check (status in ('todo','in_progress','done'));
alter table public.tasks add constraint tasks_status_completion_check check (completed = (status = 'done'));
