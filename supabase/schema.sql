-- OpenDesk - Supabase Schema
-- This schema defines lightweight, realtime-enabled tables for session metadata,
-- participants, signaling, chat, and session tokens.
-- It assumes Supabase default roles and Realtime publication.

-- Extensions
create extension if not exists pgcrypto;

-- Tables

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','active','ended','rejected')),
  allow_clipboard boolean not null default false,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_owner_id_idx on public.sessions(owner_id);
create index if not exists sessions_target_user_id_idx on public.sessions(target_user_id);
create index if not exists sessions_status_idx on public.sessions(status);

create table if not exists public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('host','controller')),
  status text not null default 'joined' check (status in ('joined','left')),
  connected_at timestamptz null,
  disconnected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index if not exists session_participants_session_id_idx on public.session_participants(session_id);
create index if not exists session_participants_user_id_idx on public.session_participants(user_id);

create table if not exists public.session_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  token text not null unique,
  issued_to uuid null references auth.users(id) on delete set null,
  purpose text not null default 'join' check (purpose in ('join')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists session_tokens_session_id_idx on public.session_tokens(session_id);
create index if not exists session_tokens_expires_at_idx on public.session_tokens(expires_at);

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  type text not null check (type in ('offer','answer','ice','status')),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid null references auth.users(id) on delete set null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists signals_session_id_idx on public.signals(session_id);
create index if not exists signals_created_at_idx on public.signals(created_at);
create index if not exists signals_recipient_user_id_idx on public.signals(recipient_user_id);

create table if not exists public.chat_messages (
  id bigserial primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_id_idx on public.chat_messages(session_id);
create index if not exists chat_messages_created_at_idx on public.chat_messages(created_at);

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  updated_at timestamptz,
  username text unique,
  full_name text,
  avatar_url text,

  constraint username_length check (char_length(username) >= 3)
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_sessions_updated_at on public.sessions;
create trigger set_sessions_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_participants_updated_at on public.session_participants;
create trigger set_participants_updated_at
before update on public.session_participants
for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Trigger to create a profile for new users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, username)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'username');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Realtime publication (enable replication)
-- Ensure the supabase_realtime publication exists (it does by default on Supabase projects).
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.session_participants;
alter publication supabase_realtime add table public.signals;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.profiles;

-- Row Level Security
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_tokens enable row level security;
alter table public.signals enable row level security;
alter table public.chat_messages enable row level security;
alter table public.profiles enable row level security;

-- Policies

-- Sessions
do $$
begin
  -- SELECT: owners, targets, and participants can view the session
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sessions' and policyname = 'select_own_target_or_participant'
  ) then
    create policy select_own_target_or_participant on public.sessions
      for select
      to authenticated
      using (
        owner_id = auth.uid()
        or target_user_id = auth.uid()
        or exists (
          select 1 from public.session_participants sp
          where sp.session_id = sessions.id and sp.user_id = auth.uid()
        )
      );
  end if;

  -- INSERT: disallow from clients; only service role may insert via server
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sessions' and policyname = 'insert_disallowed_clients'
  ) then
    create policy insert_disallowed_clients on public.sessions
      for insert
      to authenticated
      with check (false);
  end if;

  -- UPDATE: owner may update certain fields (optional). Keep disallowed for clients by default.
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sessions' and policyname = 'update_disallowed_clients'
  ) then
    create policy update_disallowed_clients on public.sessions
      for update
      to authenticated
      using (false)
      with check (false);
  end if;

  -- DELETE: disallow for clients
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sessions' and policyname = 'delete_disallowed_clients'
  ) then
    create policy delete_disallowed_clients on public.sessions
      for delete
      to authenticated
      using (false);
  end if;
end$$;

-- Session Participants
do $$
begin
  -- SELECT: participants of a session can see all participants for that session
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'session_participants' and policyname = 'select_session_participants_visible'
  ) then
    create policy select_session_participants_visible on public.session_participants
      for select
      to authenticated
      using (
        exists (
          select 1 from public.session_participants sp2
          where sp2.session_id = session_participants.session_id
          and sp2.user_id = auth.uid()
        )
        or exists (
          select 1 from public.sessions s where s.id = session_participants.session_id
          and (s.owner_id = auth.uid() or s.target_user_id = auth.uid())
        )
      );
  end if;

  -- INSERT/UPDATE/DELETE: clients disallowed; managed by server using service role
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'session_participants' and policyname = 'participants_mutation_disallowed_clients'
  ) then
    create policy participants_mutation_disallowed_clients on public.session_participants
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end$$;

-- Session Tokens
do $$
begin
  -- SELECT: only participants and owners/targets can view tokens for a session (usually not necessary on client)
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'session_tokens' and policyname = 'select_tokens_limited'
  ) then
    create policy select_tokens_limited on public.session_tokens
      for select
      to authenticated
      using (
        exists (
          select 1 from public.sessions s
          where s.id = session_tokens.session_id
          and (
            s.owner_id = auth.uid() or s.target_user_id = auth.uid()
            or exists (select 1 from public.session_participants sp where sp.session_id = s.id and sp.user_id = auth.uid())
          )
        )
      );
  end if;

  -- INSERT/UPDATE/DELETE: clients disallowed
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'session_tokens' and policyname = 'tokens_mutation_disallowed_clients'
  ) then
    create policy tokens_mutation_disallowed_clients on public.session_tokens
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end$$;

-- Signals
do $$
begin
  -- SELECT: participants of the session can read signals
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'signals' and policyname = 'select_signals_visible_to_participants'
  ) then
    create policy select_signals_visible_to_participants on public.signals
      for select
      to authenticated
      using (
        exists (
          select 1 from public.session_participants sp
          where sp.session_id = signals.session_id
          and sp.user_id = auth.uid()
        )
        or exists (
          select 1 from public.sessions s where s.id = signals.session_id
          and (s.owner_id = auth.uid() or s.target_user_id = auth.uid())
        )
      );
  end if;

  -- INSERT/UPDATE/DELETE: clients disallowed; server inserts with service role
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'signals' and policyname = 'signals_mutation_disallowed_clients'
  ) then
    create policy signals_mutation_disallowed_clients on public.signals
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end$$;

-- Chat Messages
do $$
begin
  -- SELECT: participants and owners/targets can read chat messages
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_messages' and policyname = 'select_chat_visible_to_participants'
  ) then
    create policy select_chat_visible_to_participants on public.chat_messages
      for select
      to authenticated
      using (
        exists (
          select 1 from public.session_participants sp
          where sp.session_id = chat_messages.session_id and sp.user_id = auth.uid()
        )
        or exists (
          select 1 from public.sessions s where s.id = chat_messages.session_id
          and (s.owner_id = auth.uid() or s.target_user_id = auth.uid())
        )
      );
  end if;

  -- INSERT/UPDATE/DELETE: clients disallowed; server inserts using service role
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_messages' and policyname = 'chat_mutation_disallowed_clients'
  ) then
    create policy chat_mutation_disallowed_clients on public.chat_messages
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end$$;

-- Profiles
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'select_all_profiles'
  ) then
    create policy select_all_profiles on public.profiles
      for select
      to authenticated
      using ( true );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'insert_own_profile'
  ) then
    create policy insert_own_profile on public.profiles
      for insert
      to authenticated
      with check ( auth.uid() = id );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'update_own_profile'
  ) then
    create policy update_own_profile on public.profiles
      for update
      to authenticated
      using ( auth.uid() = id );
  end if;
end$$;
