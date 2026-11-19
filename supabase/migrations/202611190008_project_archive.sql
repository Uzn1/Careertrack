create table public.project_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null,
  title text not null check(char_length(trim(title)) between 1 and 200),
  kind text not null check(kind in ('자소서','포트폴리오','JD','기업 분석','기타')),
  content text not null default '' check(char_length(content)<=50000),
  url text check(url is null or (char_length(url)<=2048 and url ~ '^https?://')),
  file_name text check(file_name is null or char_length(file_name)<=255),
  file_size integer check(file_size is null or file_size between 1 and 10485760),
  file_type text,
  storage_path text check(storage_path is null or storage_path like user_id::text||'/'||project_id::text||'/%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(project_id,user_id) references public.projects(id,user_id) on delete cascade
);
create index materials_user_project on public.project_materials(user_id,project_id);
alter table public.project_materials enable row level security;
create policy own_materials on public.project_materials for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.project_materials from anon;
grant select,insert,update,delete on public.project_materials to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('careertrack-materials','careertrack-materials',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown','image/png','image/jpeg','image/webp','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy material_file_read on storage.objects for select to authenticated using(bucket_id='careertrack-materials' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.projects p where p.id::text=(storage.foldername(name))[2] and p.user_id=(select auth.uid())));
create policy material_file_upload on storage.objects for insert to authenticated with check(bucket_id='careertrack-materials' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.projects p where p.id::text=(storage.foldername(name))[2] and p.user_id=(select auth.uid())));
create policy material_file_remove on storage.objects for delete to authenticated using(bucket_id='careertrack-materials' and (storage.foldername(name))[1]=(select auth.uid())::text);
