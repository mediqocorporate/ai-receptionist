begin;

create table public.accreditation_agencies (
  id text primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accreditation_practice_profiles (
  practice_id uuid primary key references public.practices(id) on delete cascade,
  journey_status text not null default 'NOT_SURE'
    check (journey_status in ('FIRST_ACCREDITATION','REACCREDITATION','ASSESSMENT_BOOKED','NOT_SURE')),
  assessment_scheduled boolean,
  accrediting_agency_id text references public.accreditation_agencies(id) on delete set null,
  practice_context jsonb not null default '{}'::jsonb,
  fact_provenance jsonb not null default '{}'::jsonb,
  setup_completed_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger accreditation_agencies_set_updated_at before update on public.accreditation_agencies
for each row execute function public.set_updated_at();

create trigger accreditation_practice_profiles_set_updated_at before update on public.accreditation_practice_profiles
for each row execute function public.set_updated_at();

alter table public.accreditation_agencies enable row level security;
alter table public.accreditation_practice_profiles enable row level security;

create policy accreditation_agencies_select_authenticated on public.accreditation_agencies
for select to authenticated using (is_active = true);

create policy accreditation_practice_profiles_select_member on public.accreditation_practice_profiles
for select to authenticated using (public.is_practice_member(practice_id));

commit;
