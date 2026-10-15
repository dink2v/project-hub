-- Project Hub: tabel Catatan Meeting
-- Jalankan sekali di Supabase SQL Editor setelah kode GitHub diperbarui.

create table if not exists public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  meeting_date date not null,
  meeting_time time without time zone,
  discussion text not null default '',
  division_results jsonb not null default '[]'::jsonb,
  schedules text not null default '',
  evaluation_plan text not null default '',
  additional_notes text not null default '',
  action_items jsonb not null default '[]'::jsonb,
  privacy text not null default 'private' check (privacy in ('private', 'shared')),
  editor_ids uuid[] not null default '{}'::uuid[],
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meeting_notes_workspace_updated_idx
  on public.meeting_notes (workspace_id, updated_at desc);
create index if not exists meeting_notes_editor_ids_idx
  on public.meeting_notes using gin (editor_ids);

alter table public.meeting_notes enable row level security;

drop policy if exists "Meeting notes visible to creator or shared workspace members" on public.meeting_notes;
create policy "Meeting notes visible to creator or shared workspace members"
on public.meeting_notes for select to authenticated
using (created_by = auth.uid() or (privacy = 'shared' and public.is_workspace_member(workspace_id)));

drop policy if exists "Workspace members can create meeting notes" on public.meeting_notes;
create policy "Workspace members can create meeting notes"
on public.meeting_notes for insert to authenticated
with check (created_by = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "Creator or selected editors can update meeting notes" on public.meeting_notes;
create policy "Creator or selected editors can update meeting notes"
on public.meeting_notes for update to authenticated
using (public.is_workspace_member(workspace_id) and (created_by = auth.uid() or (privacy = 'shared' and auth.uid() = any(editor_ids))))
with check (public.is_workspace_member(workspace_id) and (created_by = auth.uid() or (privacy = 'shared' and auth.uid() = any(editor_ids))));

drop policy if exists "Creator can delete meeting notes" on public.meeting_notes;
create policy "Creator can delete meeting notes"
on public.meeting_notes for delete to authenticated
using (created_by = auth.uid() and public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.meeting_notes to authenticated;
