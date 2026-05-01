create or replace function public.generate_unique_enrollment_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    exit when not exists (
      select 1
      from public.talent_profiles
      where enrollment_number = candidate
    );
  end loop;

  return candidate;
end;
$$;

alter table public.talent_profiles
add column enrollment_number text;

do $$
declare
  profile_record record;
begin
  for profile_record in
    select id
    from public.talent_profiles
    where enrollment_number is null
  loop
    update public.talent_profiles
    set enrollment_number = public.generate_unique_enrollment_number()
    where id = profile_record.id;
  end loop;
end;
$$;

alter table public.talent_profiles
alter column enrollment_number set default public.generate_unique_enrollment_number();

alter table public.talent_profiles
alter column enrollment_number set not null;

alter table public.talent_profiles
add constraint talent_profiles_enrollment_number_chk
check (enrollment_number ~ '^[0-9]{6}$');

alter table public.talent_profiles
add constraint talent_profiles_enrollment_number_key
unique (enrollment_number);
