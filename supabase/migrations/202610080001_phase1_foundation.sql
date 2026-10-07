begin;

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  job_title text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.practices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  jurisdictions text[] not null,
  practice_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practices_jurisdictions_present check (cardinality(jurisdictions) > 0),
  constraint practices_jurisdictions_valid check (jurisdictions <@ array['NSW','VIC','QLD','ACT','WA','SA','NT','TAS']::text[])
);

create table public.practice_locations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  state text not null check (state in ('NSW','VIC','QLD','ACT','WA','SA','NT','TAS')),
  address_line_1 text,
  address_line_2 text,
  suburb text,
  postcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.practice_memberships (
  practice_id uuid not null references public.practices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','practice_manager','staff')),
  status text not null default 'active' check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (practice_id, user_id)
);

create index practice_memberships_user_idx on public.practice_memberships(user_id, status);
create index practice_locations_practice_idx on public.practice_locations(practice_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger practices_set_updated_at before update on public.practices
for each row execute function public.set_updated_at();

create trigger practice_locations_set_updated_at before update on public.practice_locations
for each row execute function public.set_updated_at();

create trigger practice_memberships_set_updated_at before update on public.practice_memberships
for each row execute function public.set_updated_at();

create or replace function public.is_practice_member(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.practice_memberships pm
    where pm.practice_id = p_practice_id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
  );
$$;

create or replace function public.has_practice_role(p_practice_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.practice_memberships pm
    where pm.practice_id = p_practice_id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
      and pm.role = any(p_roles)
  );
$$;

revoke all on function public.is_practice_member(uuid) from public;
revoke all on function public.has_practice_role(uuid, text[]) from public;
grant execute on function public.is_practice_member(uuid) to authenticated;
grant execute on function public.has_practice_role(uuid, text[]) to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  account_kind text := coalesce(metadata->>'account_kind', '');
  practice_name text := btrim(coalesce(metadata->>'practice_name', ''));
  jurisdictions text[];
  new_practice_id uuid;
begin
  insert into public.profiles (id, first_name, last_name, job_title)
  values (
    new.id,
    btrim(coalesce(metadata->>'first_name', '')),
    btrim(coalesce(metadata->>'last_name', '')),
    btrim(coalesce(metadata->>'job_title', ''))
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    job_title = excluded.job_title,
    updated_at = now();

  if account_kind = 'practice_signup' then
    select coalesce(array_agg(distinct value), '{}'::text[])
      into jurisdictions
      from jsonb_array_elements_text(coalesce(metadata->'jurisdictions', '[]'::jsonb));

    if char_length(practice_name) < 2 then
      raise exception using errcode = '22023', message = 'practice_name_required';
    end if;

    if cardinality(jurisdictions) = 0
       or not (jurisdictions <@ array['NSW','VIC','QLD','ACT','WA','SA','NT','TAS']::text[]) then
      raise exception using errcode = '22023', message = 'valid_jurisdiction_required';
    end if;

    if not exists (select 1 from public.practice_memberships where user_id = new.id) then
      insert into public.practices (name, jurisdictions)
      values (practice_name, jurisdictions)
      returning id into new_practice_id;

      insert into public.practice_memberships (practice_id, user_id, role, status)
      values (new_practice_id, new.id, 'owner', 'active');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.get_current_account_context()
returns table (
  profile_id uuid,
  first_name text,
  last_name text,
  job_title text,
  practice_id uuid,
  practice_name text,
  jurisdictions text[],
  role text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.job_title,
    pr.id,
    pr.name,
    pr.jurisdictions,
    pm.role
  from public.profiles p
  left join public.practice_memberships pm
    on pm.user_id = p.id and pm.status = 'active'
  left join public.practices pr on pr.id = pm.practice_id
  where p.id = auth.uid()
  order by
    case pm.role when 'owner' then 1 when 'admin' then 2 when 'practice_manager' then 3 else 4 end,
    pm.created_at
  limit 1;
$$;

revoke all on function public.get_current_account_context() from public;
grant execute on function public.get_current_account_context() to authenticated;

alter table public.profiles enable row level security;
alter table public.practices enable row level security;
alter table public.practice_locations enable row level security;
alter table public.practice_memberships enable row level security;

create policy profiles_select_self on public.profiles
for select to authenticated using (id = auth.uid());

create policy profiles_update_self on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy practices_select_member on public.practices
for select to authenticated using (public.is_practice_member(id));

create policy practices_update_manager on public.practices
for update to authenticated
using (public.has_practice_role(id, array['owner','admin','practice_manager']::text[]))
with check (public.has_practice_role(id, array['owner','admin','practice_manager']::text[]));

create policy practice_locations_select_member on public.practice_locations
for select to authenticated using (public.is_practice_member(practice_id));

create policy practice_locations_insert_manager on public.practice_locations
for insert to authenticated
with check (public.has_practice_role(practice_id, array['owner','admin','practice_manager']::text[]));

create policy practice_locations_update_manager on public.practice_locations
for update to authenticated
using (public.has_practice_role(practice_id, array['owner','admin','practice_manager']::text[]))
with check (public.has_practice_role(practice_id, array['owner','admin','practice_manager']::text[]));

create policy practice_locations_delete_manager on public.practice_locations
for delete to authenticated
using (public.has_practice_role(practice_id, array['owner','admin','practice_manager']::text[]));

create policy practice_memberships_select_member on public.practice_memberships
for select to authenticated using (public.is_practice_member(practice_id));

commit;
