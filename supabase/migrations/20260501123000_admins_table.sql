create table public.admins (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.admins (user_id, is_active, notes)
select user_id, true, 'migrated-from-user_roles'
from public.user_roles
where role = 'admin'
on conflict (user_id) do nothing;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where user_id = auth.uid()
      and is_active = true
  );
$$;

alter table public.admins enable row level security;

create policy "admins_select_self"
on public.admins
for select
using (auth.uid() = user_id);
