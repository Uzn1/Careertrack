-- Existing databases also accept user-authored category names.
alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check check (char_length(trim(category)) between 1 and 40);
