-- Project Hub calendar events
-- Apply this migration in Supabase SQL Editor before using the Calendar page.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  event_type text not null default 'agenda'
    check (event_type in ('project', 'agenda', 'meeting', 'reminder')),
  starts_at timestamptz not null,
  ends_at timestamptz null,
  all_day boolean not null default false,
  location text null,
  description text null,
  reminder_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_valid_time check (ends_at is null or ends_at >= starts_at)
);

create index if not exists calendar_events_workspace_starts_idx
  on public.calendar_events (workspace_id, starts_at);
create index if not exists calendar_events_project_idx
  on public.calendar_events (project_id);
create index if not exists calendar_events_creator_idx
  on public.calendar_events (created_by);

alter table public.calendar_events enable row level security;
grant select, insert, update, delete on public.calendar_events to authenticated;

drop policy if exists "Workspace members can view calendar events" on public.calendar_events;
create policy "Workspace members can view calendar events"
on public.calendar_events for select to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = calendar_events.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create own calendar events" on public.calendar_events;
create policy "Workspace members can create own calendar events"
on public.calendar_events for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = calendar_events.workspace_id
      and wm.user_id = auth.uid()
  )
  and (
    project_id is null or exists (
      select 1 from public.projects p
      where p.id = calendar_events.project_id
        and p.workspace_id = calendar_events.workspace_id
    )
  )
);

drop policy if exists "Creators can update own calendar events" on public.calendar_events;
create policy "Creators can update own calendar events"
on public.calendar_events for update to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = calendar_events.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = calendar_events.workspace_id
      and wm.user_id = auth.uid()
  )
  and (
    project_id is null or exists (
      select 1 from public.projects p
      where p.id = calendar_events.project_id
        and p.workspace_id = calendar_events.workspace_id
    )
  )
);

drop policy if exists "Creators can delete own calendar events" on public.calendar_events;
create policy "Creators can delete own calendar events"
on public.calendar_events for delete to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = calendar_events.workspace_id
      and wm.user_id = auth.uid()
  )
);
