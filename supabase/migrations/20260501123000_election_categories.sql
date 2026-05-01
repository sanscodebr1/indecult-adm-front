create table public.election_categories (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (election_id, slug),
  unique (id, election_id)
);

alter table public.election_candidates
add column category_id uuid;

alter table public.election_candidates
add constraint election_candidates_category_fk
foreign key (category_id, election_id)
references public.election_categories(id, election_id)
on delete set null;

create index idx_election_categories_election_id on public.election_categories(election_id);
create index idx_election_candidates_category_id on public.election_candidates(category_id);

create trigger set_election_categories_updated_at
before update on public.election_categories
for each row
execute function public.set_updated_at();

alter table public.election_categories enable row level security;

create policy "election_categories_public_read_from_visible_elections"
on public.election_categories
for select
using (
  exists (
    select 1
    from public.elections e
    where e.id = election_categories.election_id
      and e.visibility = 'public'
      and e.status in ('scheduled', 'live', 'paused', 'finished')
  )
);

create policy "election_categories_select_admin"
on public.election_categories
for select
using (public.current_user_is_admin());
