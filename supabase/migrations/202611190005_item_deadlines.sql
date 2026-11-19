-- Application submission, aptitude tests and interviews can have different dates.
alter table public.project_items add column if not exists deadline date;
