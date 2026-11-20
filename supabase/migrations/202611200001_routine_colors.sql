alter table public.routines
  add column color text not null default 'green'
  check (color in ('green', 'blue', 'purple', 'pink', 'orange', 'gray'));
