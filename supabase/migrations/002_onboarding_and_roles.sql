-- KiberTyping — migration 002: profile details, roles, onboarding.
-- Run once in the Supabase SQL editor, after schema.sql. Safe to run again.

-- ── Profile details and roles ───────────────────────────────────────────────
alter table public.profiles
  add column if not exists display_name text check (char_length(display_name) <= 40),
  add column if not exists country text check (country ~ '^[A-Z]{2}$'),
  add column if not exists role text not null default 'user'
    check (role in ('user', 'editor', 'admin'));

-- People may edit their own name and country, but never their own role.
-- Row-level security decides WHICH rows; column grants decide WHICH columns.
revoke update on public.profiles from authenticated;
grant update (username, display_name, country) on public.profiles to authenticated;

-- Used by policies of later migrations (content editing, moderation).
create or replace function public.has_role(wanted text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (role = wanted or role = 'admin')
  );
$$;

-- ── Onboarding answers and placement results ────────────────────────────────
alter table public.user_state
  add column if not exists onboarding jsonb;

-- ── Make yourself the first admin ───────────────────────────────────────────
-- Replace the username and run this line separately:
--   update public.profiles set role = 'admin' where username = 'YOUR_USERNAME';

notify pgrst, 'reload schema';
