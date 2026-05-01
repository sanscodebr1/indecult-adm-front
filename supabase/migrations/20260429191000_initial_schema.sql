create extension if not exists pgcrypto;

create type public.user_role as enum ('talent', 'admin');
create type public.account_status as enum ('active', 'blocked');
create type public.profile_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'suspended');
create type public.change_request_type as enum ('initial_submission', 'profile_update');
create type public.change_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.media_kind as enum ('gallery_image', 'intro_video');
create type public.media_source as enum ('upload', 'youtube');
create type public.election_visibility as enum ('public', 'private');
create type public.election_status as enum ('draft', 'scheduled', 'live', 'paused', 'finished', 'cancelled');
create type public.vote_attempt_result as enum ('counted', 'invalid_captcha', 'blocked_rule', 'election_closed', 'candidate_not_eligible');

create table public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  account_status public.account_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_roles (
  user_id uuid not null references public.app_users(id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role)
);

create table public.talent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.app_users(id) on delete cascade,
  public_slug text not null unique,
  display_name text not null,
  full_name text not null,
  birth_date date,
  city text not null,
  state_code text not null,
  bio text,
  status public.profile_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.app_users(id),
  rejection_reason text,
  approved_change_request_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint talent_profiles_state_code_chk check (char_length(state_code) between 2 and 3)
);

create table public.talent_profile_media (
  id uuid primary key default gen_random_uuid(),
  talent_profile_id uuid not null references public.talent_profiles(id) on delete cascade,
  media_kind public.media_kind not null,
  source public.media_source not null,
  storage_bucket text,
  storage_path text,
  external_url text,
  mime_type text,
  file_size_bytes bigint,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint talent_profile_media_source_chk check (
    (source = 'upload' and storage_path is not null and external_url is null)
    or
    (source = 'youtube' and external_url is not null and storage_path is null)
  ),
  constraint talent_profile_media_video_chk check (
    not (media_kind = 'gallery_image' and source = 'youtube')
  )
);

create table public.profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  talent_profile_id uuid not null references public.talent_profiles(id) on delete cascade,
  requested_by uuid not null references public.app_users(id) on delete cascade,
  request_type public.change_request_type not null,
  status public.change_request_status not null default 'pending',
  proposed_profile jsonb not null default '{}'::jsonb,
  proposed_media jsonb not null default '[]'::jsonb,
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.app_users(id),
  rejection_reason text,
  applied_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.talent_profiles
  add constraint talent_profiles_approved_change_request_fk
  foreign key (approved_change_request_id) references public.profile_change_requests(id);

create table public.elections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  visibility public.election_visibility not null default 'public',
  status public.election_status not null default 'draft',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  published_at timestamptz,
  allow_public_results boolean not null default true,
  max_votes_per_ip_per_day integer,
  max_votes_per_fingerprint_per_day integer,
  created_by uuid not null references public.app_users(id),
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint elections_dates_chk check (ends_at > starts_at)
);

create table public.election_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  talent_profile_id uuid not null references public.talent_profiles(id) on delete restrict,
  candidate_number integer,
  display_order integer not null default 0,
  is_active boolean not null default true,
  added_by uuid references public.app_users(id),
  created_at timestamptz not null default timezone('utc', now()),
  unique (election_id, talent_profile_id),
  unique (election_id, candidate_number)
);

create table public.vote_attempts (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  election_candidate_id uuid not null references public.election_candidates(id) on delete cascade,
  captcha_left smallint not null,
  captcha_operator text not null,
  captcha_right smallint not null,
  captcha_answer integer not null,
  captcha_valid boolean not null,
  ip_hash text,
  user_agent_hash text,
  fingerprint_hash text,
  result public.vote_attempt_result not null,
  result_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint vote_attempts_operator_chk check (captcha_operator in ('+', '*'))
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  vote_attempt_id uuid not null unique references public.vote_attempts(id) on delete restrict,
  election_id uuid not null references public.elections(id) on delete cascade,
  election_candidate_id uuid not null references public.election_candidates(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.app_users(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_user_roles_user_id on public.user_roles(user_id);
create index idx_talent_profiles_status on public.talent_profiles(status);
create index idx_talent_profiles_user_id on public.talent_profiles(user_id);
create index idx_talent_profile_media_profile_id on public.talent_profile_media(talent_profile_id);
create index idx_profile_change_requests_profile_id on public.profile_change_requests(talent_profile_id);
create index idx_profile_change_requests_status on public.profile_change_requests(status);
create unique index idx_profile_change_requests_one_pending_per_profile
on public.profile_change_requests(talent_profile_id)
where status = 'pending';
create index idx_elections_status on public.elections(status);
create index idx_elections_visibility_status on public.elections(visibility, status);
create index idx_election_candidates_election_id on public.election_candidates(election_id);
create index idx_vote_attempts_election_id on public.vote_attempts(election_id);
create index idx_vote_attempts_candidate_id on public.vote_attempts(election_candidate_id);
create index idx_votes_election_id on public.votes(election_id);
create index idx_votes_candidate_id on public.votes(election_candidate_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger trg_app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

create trigger trg_talent_profiles_set_updated_at
before update on public.talent_profiles
for each row execute function public.set_updated_at();

create trigger trg_talent_profile_media_set_updated_at
before update on public.talent_profile_media
for each row execute function public.set_updated_at();

create trigger trg_profile_change_requests_set_updated_at
before update on public.profile_change_requests
for each row execute function public.set_updated_at();

create trigger trg_elections_set_updated_at
before update on public.elections
for each row execute function public.set_updated_at();

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name')
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'talent');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace view public.election_candidate_rankings
with (security_invoker = true)
as
with vote_totals as (
  select
    ec.id as election_candidate_id,
    ec.election_id,
    ec.talent_profile_id,
    tp.display_name,
    count(v.id) as vote_count
  from public.election_candidates ec
  join public.talent_profiles tp on tp.id = ec.talent_profile_id
  left join public.votes v on v.election_candidate_id = ec.id
  where ec.is_active = true
  group by ec.id, ec.election_id, ec.talent_profile_id, tp.display_name
)
select
  election_id,
  election_candidate_id,
  talent_profile_id,
  display_name,
  vote_count,
  rank() over (partition by election_id order by vote_count desc, display_name asc) as ranking_position
from vote_totals;

alter table public.app_users enable row level security;
alter table public.user_roles enable row level security;
alter table public.talent_profiles enable row level security;
alter table public.talent_profile_media enable row level security;
alter table public.profile_change_requests enable row level security;
alter table public.elections enable row level security;
alter table public.election_candidates enable row level security;
alter table public.vote_attempts enable row level security;
alter table public.votes enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "app_users_select_self"
on public.app_users
for select
using (auth.uid() = id);

create policy "app_users_update_self"
on public.app_users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "app_users_select_admin"
on public.app_users
for select
using (public.current_user_is_admin());

create policy "user_roles_select_self"
on public.user_roles
for select
using (auth.uid() = user_id);

create policy "user_roles_select_admin"
on public.user_roles
for select
using (public.current_user_is_admin());

create policy "talent_profiles_public_read_approved"
on public.talent_profiles
for select
using (status = 'approved');

create policy "talent_profiles_select_owner"
on public.talent_profiles
for select
using (auth.uid() = user_id);

create policy "talent_profiles_select_admin"
on public.talent_profiles
for select
using (public.current_user_is_admin());

create policy "talent_profile_media_public_read_from_approved_profiles"
on public.talent_profile_media
for select
using (
  exists (
    select 1
    from public.talent_profiles tp
    where tp.id = talent_profile_media.talent_profile_id
      and tp.status = 'approved'
  )
);

create policy "talent_profile_media_select_owner"
on public.talent_profile_media
for select
using (
  exists (
    select 1
    from public.talent_profiles tp
    where tp.id = talent_profile_media.talent_profile_id
      and tp.user_id = auth.uid()
  )
);

create policy "talent_profile_media_select_admin"
on public.talent_profile_media
for select
using (public.current_user_is_admin());

create policy "profile_change_requests_select_owner"
on public.profile_change_requests
for select
using (requested_by = auth.uid());

create policy "profile_change_requests_select_admin"
on public.profile_change_requests
for select
using (public.current_user_is_admin());

create policy "elections_public_read_visible"
on public.elections
for select
using (
  visibility = 'public'
  and status in ('scheduled', 'live', 'paused', 'finished')
);

create policy "elections_select_admin"
on public.elections
for select
using (public.current_user_is_admin());

create policy "election_candidates_public_read_from_visible_elections"
on public.election_candidates
for select
using (
  exists (
    select 1
    from public.elections e
    where e.id = election_candidates.election_id
      and e.visibility = 'public'
      and e.status in ('scheduled', 'live', 'paused', 'finished')
  )
);

create policy "election_candidates_select_admin"
on public.election_candidates
for select
using (public.current_user_is_admin());

create policy "votes_select_admin"
on public.votes
for select
using (public.current_user_is_admin());

create policy "vote_attempts_select_admin"
on public.vote_attempts
for select
using (public.current_user_is_admin());

create policy "admin_audit_logs_select_admin"
on public.admin_audit_logs
for select
using (public.current_user_is_admin());
