alter type public.vote_attempt_result add value if not exists 'invalid_challenge';

create table public.vote_challenges (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  operand_left smallint not null,
  operator text not null,
  operand_right smallint not null,
  answer_value integer not null,
  ip_hash text,
  fingerprint_hash text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint vote_challenges_operator_chk check (operator in ('+', '*')),
  constraint vote_challenges_expiration_chk check (expires_at > created_at)
);

alter table public.vote_attempts
  add column vote_challenge_id uuid references public.vote_challenges(id) on delete set null;

create index idx_vote_challenges_election_id on public.vote_challenges(election_id);
create index idx_vote_challenges_expires_at on public.vote_challenges(expires_at);
create index idx_vote_attempts_vote_challenge_id on public.vote_attempts(vote_challenge_id);

create or replace function public.claim_vote_challenge(
  p_challenge_id uuid,
  p_ip_hash text,
  p_fingerprint_hash text
)
returns setof public.vote_challenges
language sql
security definer
set search_path = public
as $$
  update public.vote_challenges
  set used_at = timezone('utc', now())
  where id = p_challenge_id
    and used_at is null
    and expires_at > timezone('utc', now())
    and (ip_hash is null or ip_hash = p_ip_hash)
    and (fingerprint_hash is null or fingerprint_hash = p_fingerprint_hash)
  returning *;
$$;

alter table public.vote_challenges enable row level security;

create policy "vote_challenges_select_admin"
on public.vote_challenges
for select
using (public.current_user_is_admin());
