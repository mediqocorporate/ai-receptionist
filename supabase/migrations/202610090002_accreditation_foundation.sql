begin;

create table public.accreditation_standard_versions (
  id text primary key,
  code text not null unique,
  name text not null,
  edition text not null,
  effective_from date,
  effective_to date,
  workspace_type text not null check (workspace_type in ('CURRENT','FUTURE_READINESS')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accreditation_requirements (
  id text primary key,
  standard_version_id text not null references public.accreditation_standard_versions(id) on delete restrict,
  indicator text not null,
  criterion text not null,
  criterion_description text not null default '',
  classification text not null check (classification in ('MANDATORY','ASPIRATIONAL','UNVERIFIED')),
  classification_source text not null default '',
  plain_english_requirement text not null,
  applicability_rule text not null default '',
  primary_readiness_question text not null default '',
  assessment_basis text not null default '',
  appears_ready_rule text not null default '',
  needs_attention_rule text not null default '',
  confirmed_gap_rule text not null default '',
  not_checked_rule text not null default '',
  quick_check_priority text not null check (quick_check_priority in ('P1','P2','P3')),
  critical_safety_area boolean not null default false,
  national_not_met_count integer,
  national_not_met_rank integer,
  content_validation_status text not null check (content_validation_status in ('VALIDATION_REQUIRED','HOLD')),
  content_validation_source text not null default '',
  source_urls jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accreditation_questions (
  id text primary key,
  requirement_id text not null references public.accreditation_requirements(id) on delete cascade,
  purpose text not null default '',
  wording text not null,
  show_rule text not null default '',
  contextualisation_rule text not null default '',
  evidence_prompt text not null default '',
  clarification_template text not null default '',
  why_we_ask text not null default '',
  asked_because text not null default '',
  quick_check_priority text not null check (quick_check_priority in ('P1','P2','P3')),
  validation_status text not null check (validation_status in ('VALIDATION_REQUIRED','HOLD')),
  validation_source text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accreditation_answer_options (
  question_id text not null references public.accreditation_questions(id) on delete cascade,
  option_order integer not null check (option_order > 0),
  label text not null,
  option_type text not null default '',
  default_branch_behaviour text not null default '',
  primary key (question_id, option_order)
);

create table public.accreditation_branching_rules (
  question_id text not null references public.accreditation_questions(id) on delete cascade,
  branch_order integer not null check (branch_order > 0),
  requirement_id text not null references public.accreditation_requirements(id) on delete cascade,
  trigger text not null default '',
  follow_up_wording text not null,
  suppression_rule text not null default '',
  primary key (question_id, branch_order)
);

create table public.accreditation_evidence_criteria (
  requirement_id text not null references public.accreditation_requirements(id) on delete cascade,
  evidence_type text not null,
  role text not null default '',
  evidence_rule text not null default '',
  assessment_dimensions text[] not null default '{}'::text[],
  primary key (requirement_id, evidence_type)
);

create table public.accreditation_sources (
  id text primary key,
  publisher text not null,
  title text not null,
  current_use text not null default '',
  url text not null,
  used_for text not null default '',
  verification text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accreditation_cycles (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  standard_version_id text not null references public.accreditation_standard_versions(id) on delete restrict,
  target_assessment_date date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','ARCHIVED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, practice_id)
);

create unique index accreditation_cycles_one_active_idx
on public.accreditation_cycles(practice_id, standard_version_id)
where status = 'ACTIVE';

create table public.practice_requirements (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  requirement_id text not null references public.accreditation_requirements(id) on delete cascade,
  applicability_status text not null default 'UNKNOWN' check (applicability_status in ('UNKNOWN','APPLICABLE','NOT_APPLICABLE')),
  readiness_status text not null default 'NOT_CHECKED' check (readiness_status in ('APPEARS_READY','NEEDS_ATTENTION','CONFIRMED_GAP','NOT_CHECKED')),
  verification_status text check (verification_status is null or verification_status in ('USER_REPORTED','EVIDENCE_UPLOADED','AI_REVIEWED','MANUALLY_VERIFIED')),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status_reason text not null default 'More information required',
  known_facts jsonb not null default '[]'::jsonb,
  unknown_facts jsonb not null default '[]'::jsonb,
  potential_gaps jsonb not null default '[]'::jsonb,
  confirmed_gaps jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  last_assessed_at timestamptz,
  requires_reassessment boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_requirements_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  unique (cycle_id, requirement_id)
);

create table public.readiness_responses (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  requirement_id text not null references public.accreditation_requirements(id) on delete cascade,
  question_id text not null references public.accreditation_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer_label text not null,
  answer_detail jsonb not null default '{}'::jsonb,
  verification_status text not null default 'USER_REPORTED' check (verification_status in ('USER_REPORTED','EVIDENCE_UPLOADED','AI_REVIEWED','MANUALLY_VERIFIED')),
  answered_at timestamptz not null default now(),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint readiness_responses_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade
);

create index accreditation_requirements_priority_idx on public.accreditation_requirements(standard_version_id, quick_check_priority, is_active);
create index accreditation_requirements_critical_idx on public.accreditation_requirements(standard_version_id, critical_safety_area, is_active);
create index accreditation_questions_requirement_idx on public.accreditation_questions(requirement_id, quick_check_priority, is_active);
create index accreditation_cycles_practice_idx on public.accreditation_cycles(practice_id, status);
create index practice_requirements_cycle_idx on public.practice_requirements(cycle_id, readiness_status);
create index readiness_responses_cycle_idx on public.readiness_responses(cycle_id, requirement_id, question_id, answered_at desc);

create trigger accreditation_standard_versions_set_updated_at before update on public.accreditation_standard_versions
for each row execute function public.set_updated_at();
create trigger accreditation_requirements_set_updated_at before update on public.accreditation_requirements
for each row execute function public.set_updated_at();
create trigger accreditation_questions_set_updated_at before update on public.accreditation_questions
for each row execute function public.set_updated_at();
create trigger accreditation_sources_set_updated_at before update on public.accreditation_sources
for each row execute function public.set_updated_at();
create trigger accreditation_cycles_set_updated_at before update on public.accreditation_cycles
for each row execute function public.set_updated_at();
create trigger practice_requirements_set_updated_at before update on public.practice_requirements
for each row execute function public.set_updated_at();

alter table public.accreditation_standard_versions enable row level security;
alter table public.accreditation_requirements enable row level security;
alter table public.accreditation_questions enable row level security;
alter table public.accreditation_answer_options enable row level security;
alter table public.accreditation_branching_rules enable row level security;
alter table public.accreditation_evidence_criteria enable row level security;
alter table public.accreditation_sources enable row level security;
alter table public.accreditation_cycles enable row level security;
alter table public.practice_requirements enable row level security;
alter table public.readiness_responses enable row level security;

create policy accreditation_standard_versions_select_authenticated on public.accreditation_standard_versions
for select to authenticated using (true);
create policy accreditation_requirements_select_authenticated on public.accreditation_requirements
for select to authenticated using (true);
create policy accreditation_questions_select_authenticated on public.accreditation_questions
for select to authenticated using (true);
create policy accreditation_answer_options_select_authenticated on public.accreditation_answer_options
for select to authenticated using (true);
create policy accreditation_branching_rules_select_authenticated on public.accreditation_branching_rules
for select to authenticated using (true);
create policy accreditation_evidence_criteria_select_authenticated on public.accreditation_evidence_criteria
for select to authenticated using (true);
create policy accreditation_sources_select_authenticated on public.accreditation_sources
for select to authenticated using (true);

create policy accreditation_cycles_select_member on public.accreditation_cycles
for select to authenticated using (public.is_practice_member(practice_id));
create policy practice_requirements_select_member on public.practice_requirements
for select to authenticated using (public.is_practice_member(practice_id));
create policy readiness_responses_select_member on public.readiness_responses
for select to authenticated using (public.is_practice_member(practice_id));
insert into public.accreditation_standard_versions (
  id, code, name, edition, workspace_type, is_active
) values (
  'RACGP5',
  'RACGP5',
  'RACGP Standards for general practices',
  '5th edition',
  'CURRENT',
  true
)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  edition = excluded.edition,
  workspace_type = excluded.workspace_type,
  is_active = excluded.is_active,
  updated_at = now();

commit;
