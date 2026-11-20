alter table public.routines drop constraint routines_end_time_check;
alter table public.routines add constraint routines_end_time_check
  check ((end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or end_time = '24:00') and end_time > start_time);
