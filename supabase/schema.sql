-- KiberTyping — Supabase schema.
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null check (username ~ '^[A-Za-z0-9_-]{3,20}$'),
  created_at  timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "profiles are public" on public.profiles
  for select using (true);
create policy "users update their own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Create the profile row automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'user_' || substr(new.id::text, 1, 8))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Results ─────────────────────────────────────────────────────────────────
create table if not exists public.results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  client_id    text not null,
  kind         text not null check (kind in ('test', 'lesson', 'practice')),
  category     text not null check (category in ('symbols', 'commands', 'terms', 'mixed')),
  mode         text not null check (mode in ('time', 'words')),
  length       integer not null check (length between 1 and 100000),
  topic        text,
  strict       boolean not null default false,
  lesson_id    text,
  wpm          numeric(6, 1) not null check (wpm >= 0 and wpm <= 350),
  raw          numeric(6, 1) not null check (raw >= 0 and raw <= 450),
  accuracy     numeric(5, 1) not null check (accuracy between 0 and 100),
  consistency  numeric(5, 1) not null check (consistency between 0 and 100),
  duration_ms  integer not null check (duration_ms > 0),
  chars        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists results_user_created_idx on public.results (user_id, created_at desc);
create index if not exists results_board_idx on public.results (category, mode, length, wpm desc);

alter table public.results enable row level security;

-- Results are public so the leaderboard can read them; only the owner can write.
create policy "results are public" on public.results
  for select using (true);
create policy "users insert their own results" on public.results
  for insert with check (auth.uid() = user_id);
create policy "users delete their own results" on public.results
  for delete using (auth.uid() = user_id);

-- ── Per-user state: typing profile (weak keys) and lesson progress ──────────
create table if not exists public.user_state (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  profile     jsonb not null default '{}'::jsonb,
  lessons     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "users read their own state" on public.user_state
  for select using (auth.uid() = user_id);
create policy "users insert their own state" on public.user_state
  for insert with check (auth.uid() = user_id);
create policy "users update their own state" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Leaderboard: each user's best standard test per category / mode / length ─
create or replace view public.leaderboard
with (security_invoker = on) as
select distinct on (r.user_id, r.category, r.mode, r.length)
  r.user_id,
  p.username,
  r.category,
  r.mode,
  r.length,
  r.wpm,
  r.raw,
  r.accuracy,
  r.consistency,
  r.created_at
from public.results r
join public.profiles p on p.id = r.user_id
where r.kind = 'test'
  and r.topic is null
  and r.accuracy >= 85
order by r.user_id, r.category, r.mode, r.length, r.wpm desc;

grant select on public.leaderboard to anon, authenticated;
