alter table public.user_settings add column if not exists monthly_priorities jsonb not null default '{}'::jsonb check(jsonb_typeof(monthly_priorities)='object');
create or replace function public.set_monthly_priorities(p_month text,p_priorities jsonb)
returns public.user_settings language plpgsql security invoker set search_path=public as $$
declare saved public.user_settings;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or jsonb_typeof(p_priorities) is distinct from 'array' or jsonb_array_length(p_priorities)>3 then raise exception 'Invalid month or priorities';end if;
 if exists(select 1 from jsonb_array_elements(p_priorities) entry where jsonb_typeof(entry)<>'string' or char_length(entry #>> '{}')>200) then raise exception 'Invalid priority text';end if;
 insert into public.user_settings(user_id,monthly_priorities) values(auth.uid(),jsonb_build_object(p_month,p_priorities))
 on conflict(user_id) do update set monthly_priorities=user_settings.monthly_priorities||excluded.monthly_priorities returning * into saved;
 return saved;
end $$;
revoke all on function public.set_monthly_priorities(text,jsonb) from public,anon;
grant execute on function public.set_monthly_priorities(text,jsonb) to authenticated;
