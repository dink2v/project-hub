-- Project Hub: shareable workspace invitations (anyone with the link).
-- Apply this migration in Supabase SQL Editor before enabling invite links.

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null default 'Viewer' check (role in ('Viewer', 'Editor')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz null
);

create index if not exists workspace_invites_workspace_created_idx
  on public.workspace_invites (workspace_id, created_at desc);

alter table public.workspace_invites enable row level security;

-- Invite tokens are never readable or writable directly by browser clients.
revoke all on public.workspace_invites from anon, authenticated;

create or replace function public.create_workspace_invite(
  p_workspace_id uuid,
  p_role text default 'Viewer'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token uuid;
  v_workspace_name text;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Login diperlukan untuk membuat undangan.';
  end if;

  if p_role not in ('Viewer', 'Editor') then
    raise exception 'Peran undangan tidak valid.';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = v_user_id
      and wm.role = 'Owner'
  ) then
    raise exception 'Hanya Owner workspace yang dapat membuat link undangan.';
  end if;

  select w.name into v_workspace_name
  from public.workspaces w
  where w.id = p_workspace_id;

  if v_workspace_name is null then
    raise exception 'Workspace tidak ditemukan.';
  end if;

  v_token := gen_random_uuid();
  v_expires_at := now() + interval '30 days';

  insert into public.workspace_invites (
    token, workspace_id, role, created_by, expires_at
  ) values (
    v_token, p_workspace_id, p_role, v_user_id, v_expires_at
  );

  return jsonb_build_object(
    'token', v_token,
    'workspace_id', p_workspace_id,
    'workspace_name', v_workspace_name,
    'role', p_role,
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.accept_workspace_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.workspace_invites%rowtype;
  v_workspace_name text;
  v_existing_role text;
begin
  if v_user_id is null then
    raise exception 'Masuk atau daftar terlebih dahulu untuk menerima undangan.';
  end if;

  select * into v_invite
  from public.workspace_invites wi
  where wi.token = p_token
    and wi.revoked_at is null
    and wi.expires_at > now()
  limit 1;

  if not found then
    raise exception 'Link undangan tidak valid atau sudah kedaluwarsa.';
  end if;

  select w.name into v_workspace_name
  from public.workspaces w
  where w.id = v_invite.workspace_id;

  if v_workspace_name is null then
    raise exception 'Workspace dari undangan ini sudah tidak tersedia.';
  end if;

  select wm.role into v_existing_role
  from public.workspace_members wm
  where wm.workspace_id = v_invite.workspace_id
    and wm.user_id = v_user_id
  limit 1;

  if v_existing_role is null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_invite.workspace_id, v_user_id, v_invite.role);
    v_existing_role := v_invite.role;
  end if;

  return jsonb_build_object(
    'workspace_id', v_invite.workspace_id,
    'workspace_name', v_workspace_name,
    'role', v_existing_role
  );
end;
$$;

revoke all on function public.create_workspace_invite(uuid, text) from public, anon;
revoke all on function public.accept_workspace_invite(uuid) from public, anon;
grant execute on function public.create_workspace_invite(uuid, text) to authenticated;
grant execute on function public.accept_workspace_invite(uuid) to authenticated;
