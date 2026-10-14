-- Project Hub: Catatan Meeting
-- Apply this migration in Supabase SQL Editor before using the Meeting pages.
create table if not exists public.meeting_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz null,
  location text null,
  agenda text not null default '',
  discussion text not null default '',
  decisions text not null default '',
  participants jsonb not null default '[]'::jsonb
    check (jsonb_typeof(participants) = 'array'),
  action_items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(action_items) = 'array'),
  attachments jsonb not null default '[]'::jsonb
    check (jsonb_typeof(attachments) = 'array'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_records_valid_time check (ends_at is null or ends_at >= starts_at)
);

create index if not exists meeting_records_workspace_starts_idx
  on public.meeting_records (workspace_id, starts_at desc);
create index if not exists meeting_records_project_starts_idx
  on public.meeting_records (project_id, starts_at desc);
create index if not exists meeting_records_creator_idx
  on public.meeting_records (created_by);

alter table public.meeting_records enable row level security;
grant select, insert, update, delete on public.meeting_records to authenticated;

drop policy if exists "Workspace members can view meeting records" on public.meeting_records;
create policy "Workspace members can view meeting records"
on public.meeting_records for select to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = meeting_records.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace editors can create meeting records" on public.meeting_records;
create policy "Workspace editors can create meeting records"
on public.meeting_records for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = meeting_records.workspace_id
      and wm.user_id = auth.uid()
  )
  and public.workspace_role(workspace_id) in ('Owner', 'Editor')
  and (
    project_id is null or exists (
      select 1 from public.projects p
      where p.id = meeting_records.project_id
        and p.workspace_id = meeting_records.workspace_id
    )
  )
);

drop policy if exists "Workspace editors can update meeting records" on public.meeting_records;
create policy "Workspace editors can update meeting records"
on public.meeting_records for update to authenticated
using (
  public.workspace_role(workspace_id) in ('Owner', 'Editor')
)
with check (
  public.workspace_role(workspace_id) in ('Owner', 'Editor')
  and (
    project_id is null or exists (
      select 1 from public.projects p
      where p.id = meeting_records.project_id
        and p.workspace_id = meeting_records.workspace_id
    )
  )
);

drop policy if exists "Workspace editors can delete meeting records" on public.meeting_records;
create policy "Workspace editors can delete meeting records"
on public.meeting_records for delete to authenticated
using (
  public.workspace_role(workspace_id) in ('Owner', 'Editor')
);

-- Private bucket for meeting attachments. Files are stored under:
-- <workspace_id>/<meeting_id>/<generated-file-name>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-hub-meeting-files',
  'project-hub-meeting-files',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Workspace members can view meeting attachments" on storage.objects;
create policy "Workspace members can view meeting attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'project-hub-meeting-files'
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace editors can upload meeting attachments" on storage.objects;
create policy "Workspace editors can upload meeting attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-hub-meeting-files'
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.user_id = auth.uid()
  )
  and public.workspace_role(((storage.foldername(name))[1])::uuid) in ('Owner', 'Editor')
);

drop policy if exists "Workspace editors can update meeting attachments" on storage.objects;
create policy "Workspace editors can update meeting attachments"
on storage.objects for update to authenticated
using (
  bucket_id = 'project-hub-meeting-files'
  and public.workspace_role(((storage.foldername(name))[1])::uuid) in ('Owner', 'Editor')
)
with check (
  bucket_id = 'project-hub-meeting-files'
  and public.workspace_role(((storage.foldername(name))[1])::uuid) in ('Owner', 'Editor')
);

drop policy if exists "Workspace editors can delete meeting attachments" on storage.objects;
create policy "Workspace editors can delete meeting attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-hub-meeting-files'
  and public.workspace_role(((storage.foldername(name))[1])::uuid) in ('Owner', 'Editor')
);
