-- ============================================================
-- UniPodium initial schema
-- Run with: supabase db push  (after supabase link)
-- Or paste into Supabase SQL editor.
-- ============================================================

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type org_role as enum ('member', 'officer', 'director');
create type request_status as enum ('pending', 'approved', 'denied', 'completed', 'no_show', 'cancelled');
create type bulletin_status as enum ('pending', 'approved', 'denied');

-- ------------------------------------------------------------
-- 1. users  (public profile mirror of auth.users)
-- ------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- auto-create a public.users row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 2. orgs
-- ------------------------------------------------------------
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  logo_url text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. org_members
-- ------------------------------------------------------------
create table public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role org_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index org_members_user_idx on public.org_members(user_id);

-- Helper: does the calling user hold role X (or higher) in org?
create or replace function public.has_org_role(target_org uuid, min_role org_role)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.org_members
    where org_id = target_org
      and user_id = auth.uid()
      and case min_role
        when 'member' then role in ('member', 'officer', 'director')
        when 'officer' then role in ('officer', 'director')
        when 'director' then role = 'director'
      end
  );
$$;

-- ------------------------------------------------------------
-- 4. meetings
-- ------------------------------------------------------------
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  title text not null,
  agenda text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  slots_open integer not null default 3,
  slot_length_minutes integer not null default 2,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meetings_org_idx on public.meetings(org_id);
create index meetings_starts_idx on public.meetings(starts_at);

-- ------------------------------------------------------------
-- 5. speak_requests
-- ------------------------------------------------------------
create table public.speak_requests (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  requester_user_id uuid not null references public.users(id),
  requester_org_id uuid references public.orgs(id),
  pitch text not null,
  requested_minutes integer not null default 2,
  status request_status not null default 'pending',
  decided_by uuid references public.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index speak_requests_meeting_idx on public.speak_requests(meeting_id);
create index speak_requests_requester_idx on public.speak_requests(requester_user_id);
create index speak_requests_status_idx on public.speak_requests(status);

-- ------------------------------------------------------------
-- 6. chat_messages
-- ------------------------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  speak_request_id uuid not null references public.speak_requests(id) on delete cascade,
  user_id uuid not null references public.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_request_idx on public.chat_messages(speak_request_id, created_at);

-- ------------------------------------------------------------
-- 7. bulletin_posts
-- ------------------------------------------------------------
create table public.bulletin_posts (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references public.users(id),
  org_id uuid references public.orgs(id),
  event_title text not null,
  event_description text,
  event_at timestamptz not null,
  event_location text,
  status bulletin_status not null default 'pending',
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index bulletin_status_idx on public.bulletin_posts(status, event_at);

-- ------------------------------------------------------------
-- updated_at trigger helper
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orgs_set_updated_at before update on public.orgs
  for each row execute function public.set_updated_at();
create trigger meetings_set_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();
create trigger speak_requests_set_updated_at before update on public.speak_requests
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users enable row level security;
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.meetings enable row level security;
alter table public.speak_requests enable row level security;
alter table public.chat_messages enable row level security;
alter table public.bulletin_posts enable row level security;

-- users: anyone authenticated can read basic profile; only self can update
create policy "users_read_all" on public.users
  for select to authenticated using (true);
create policy "users_update_self" on public.users
  for update to authenticated using (id = auth.uid());

-- orgs: anyone authenticated can read; directors can update; anyone can create
create policy "orgs_read_all" on public.orgs
  for select to authenticated using (true);
create policy "orgs_insert_authenticated" on public.orgs
  for insert to authenticated with check (created_by = auth.uid());
create policy "orgs_update_directors" on public.orgs
  for update to authenticated using (public.has_org_role(id, 'director'));
create policy "orgs_delete_directors" on public.orgs
  for delete to authenticated using (public.has_org_role(id, 'director'));

-- org_members: readable to all authenticated; directors manage
create policy "org_members_read_all" on public.org_members
  for select to authenticated using (true);
create policy "org_members_insert_directors" on public.org_members
  for insert to authenticated with check (public.has_org_role(org_id, 'director'));
create policy "org_members_update_directors" on public.org_members
  for update to authenticated using (public.has_org_role(org_id, 'director'));
create policy "org_members_delete_directors_or_self" on public.org_members
  for delete to authenticated using (
    public.has_org_role(org_id, 'director') or user_id = auth.uid()
  );

-- meetings: everyone authenticated reads; officers+ of the org manage
create policy "meetings_read_all" on public.meetings
  for select to authenticated using (true);
create policy "meetings_insert_officers" on public.meetings
  for insert to authenticated with check (public.has_org_role(org_id, 'officer'));
create policy "meetings_update_officers" on public.meetings
  for update to authenticated using (public.has_org_role(org_id, 'officer'));
create policy "meetings_delete_officers" on public.meetings
  for delete to authenticated using (public.has_org_role(org_id, 'officer'));

-- speak_requests: requester + directors of the target org can read/manage
create policy "speak_requests_read_relevant" on public.speak_requests
  for select to authenticated using (
    requester_user_id = auth.uid()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and public.has_org_role(m.org_id, 'officer')
    )
  );
create policy "speak_requests_insert_self" on public.speak_requests
  for insert to authenticated with check (requester_user_id = auth.uid());
-- Requester can update their own to cancel it; org officers can approve/deny/mark no-show
create policy "speak_requests_update_relevant" on public.speak_requests
  for update to authenticated using (
    (requester_user_id = auth.uid() and status = 'pending')
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and public.has_org_role(m.org_id, 'officer')
    )
  );

-- chat_messages: only requester and org officers of the meeting's org can read/write
create policy "chat_read_relevant" on public.chat_messages
  for select to authenticated using (
    exists (
      select 1 from public.speak_requests sr
      join public.meetings m on m.id = sr.meeting_id
      where sr.id = speak_request_id
        and (sr.requester_user_id = auth.uid() or public.has_org_role(m.org_id, 'officer'))
    )
  );
create policy "chat_write_relevant" on public.chat_messages
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.speak_requests sr
      join public.meetings m on m.id = sr.meeting_id
      where sr.id = speak_request_id
        and (sr.requester_user_id = auth.uid() or public.has_org_role(m.org_id, 'officer'))
    )
  );

-- bulletin_posts: read approved (or own); insert self; only admins/site staff update status (TODO Phase 7)
create policy "bulletin_read_approved_or_own" on public.bulletin_posts
  for select to authenticated using (
    status = 'approved' or submitter_id = auth.uid()
  );
create policy "bulletin_insert_self" on public.bulletin_posts
  for insert to authenticated with check (submitter_id = auth.uid());
-- Admin review policy will be added Phase 7 (needs a site-admin flag on users)

-- ============================================================
-- Realtime — enable replication for chat + speak_requests
-- ============================================================
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.speak_requests;
