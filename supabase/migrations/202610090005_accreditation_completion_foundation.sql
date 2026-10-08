begin;

create extension if not exists vector with schema extensions;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'accreditation-evidence',
  'accreditation-evidence',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.accreditation_evidence (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  storage_bucket text not null default 'accreditation-evidence',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 10485760),
  category text not null default 'OTHER'
    check (category in ('POLICY_PROCEDURE','REGISTER','TRAINING_CREDENTIAL','CERTIFICATE','AUDIT_REPORT','MEETING_RECORD','EQUIPMENT_MAINTENANCE','PATIENT_FEEDBACK','OTHER')),
  title text not null default '',
  description text not null default '',
  document_date date,
  review_date date,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','SUPERSEDED','ARCHIVED')),
  version integer not null default 1 check (version > 0),
  supersedes_evidence_id uuid references public.accreditation_evidence(id) on delete set null,
  source_hash text,
  notes text not null default '',
  processing_status text not null default 'NOT_REVIEWED'
    check (processing_status in ('PENDING','PROCESSING','COMPLETE','FAILED','NOT_REVIEWED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditation_evidence_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  unique (id, practice_id, cycle_id)
);

create table public.accreditation_evidence_requirement_links (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  evidence_id uuid not null,
  requirement_id text not null references public.accreditation_requirements(id) on delete cascade,
  relationship_type text not null default 'SUPPORTS'
    check (relationship_type in ('SUPPORTS','POTENTIAL_SUPPORT','CONTRADICTS','REFERENCE')),
  mapped_by text not null default 'USER'
    check (mapped_by in ('USER','AI_SUGGESTION','MANUALLY_VERIFIED')),
  mapping_confidence numeric(4,3) check (mapping_confidence is null or (mapping_confidence >= 0 and mapping_confidence <= 1)),
  mapping_reason text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditation_evidence_links_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  constraint accreditation_evidence_links_evidence_fk
    foreign key (evidence_id, practice_id, cycle_id) references public.accreditation_evidence(id, practice_id, cycle_id) on delete cascade,
  unique (evidence_id, requirement_id)
);

create table public.accreditation_evidence_assessments (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  evidence_id uuid not null,
  requirement_id text not null references public.accreditation_requirements(id) on delete cascade,
  review_status text not null default 'NOT_REVIEWED'
    check (review_status in ('SUFFICIENT_FOR_REVIEW','INCOMPLETE','OUTDATED','CONFLICTING','NOT_REVIEWED','MORE_INFORMATION_REQUIRED')),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  reason text not null default '',
  extracted_facts jsonb not null default '[]'::jsonb,
  missing_elements jsonb not null default '[]'::jsonb,
  detected_dates jsonb not null default '[]'::jsonb,
  recommended_action text not null default '',
  model text,
  openai_response_id text,
  human_review_required boolean not null default true,
  is_active boolean not null default true,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint accreditation_evidence_assessment_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  constraint accreditation_evidence_assessment_evidence_fk
    foreign key (evidence_id, practice_id, cycle_id) references public.accreditation_evidence(id, practice_id, cycle_id) on delete cascade
);

create table public.accreditation_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  evidence_id uuid not null,
  job_type text not null default 'EVIDENCE_REVIEW'
    check (job_type in ('TEXT_EXTRACTION','EVIDENCE_REVIEW','REASSESS_REQUIREMENTS')),
  status text not null default 'PENDING'
    check (status in ('PENDING','PROCESSING','COMPLETE','FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditation_processing_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  constraint accreditation_processing_evidence_fk
    foreign key (evidence_id, practice_id, cycle_id) references public.accreditation_evidence(id, practice_id, cycle_id) on delete cascade
);

create table public.accreditation_team_members (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  display_name text not null,
  role text not null default '',
  engagement_type text not null default '',
  locations text[] not null default '{}'::text[],
  is_active boolean not null default true,
  notes text not null default '',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditation_team_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  unique (id, practice_id, cycle_id)
);

create table public.accreditation_credentials (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  team_member_id uuid not null,
  credential_type text not null,
  issuer text not null default '',
  identifier text not null default '',
  issue_date date,
  expiry_date date,
  evidence_id uuid references public.accreditation_evidence(id) on delete set null,
  status text not null default 'NOT_CHECKED'
    check (status in ('CURRENT','DUE_SOON','EXPIRED','NOT_CHECKED')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditation_credentials_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  constraint accreditation_credentials_team_fk
    foreign key (team_member_id, practice_id, cycle_id) references public.accreditation_team_members(id, practice_id, cycle_id) on delete cascade
);

create table public.accreditation_training_records (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  team_member_id uuid not null,
  training_type text not null,
  provider text not null default '',
  completed_date date,
  expiry_date date,
  evidence_id uuid references public.accreditation_evidence(id) on delete set null,
  status text not null default 'NOT_CHECKED'
    check (status in ('CURRENT','DUE_SOON','EXPIRED','NOT_CHECKED')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditation_training_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  constraint accreditation_training_team_fk
    foreign key (team_member_id, practice_id, cycle_id) references public.accreditation_team_members(id, practice_id, cycle_id) on delete cascade
);

create table public.accreditation_actions (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  requirement_id text references public.accreditation_requirements(id) on delete set null,
  evidence_id uuid references public.accreditation_evidence(id) on delete set null,
  team_member_id uuid references public.accreditation_team_members(id) on delete set null,
  title text not null,
  description text not null default '',
  action_type text not null default 'FOLLOW_UP',
  priority text not null default 'MEDIUM'
    check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  owner_user_id uuid references auth.users(id) on delete set null,
  due_date date,
  status text not null default 'OPEN'
    check (status in ('OPEN','IN_PROGRESS','BLOCKED','DONE')),
  source_reason text not null default '',
  created_by_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  completion_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditation_actions_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade
);

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references public.practices(id) on delete cascade,
  scope text not null default 'GLOBAL_APPROVED'
    check (scope in ('GLOBAL_APPROVED','PRACTICE_PRIVATE')),
  publisher text not null,
  canonical_title text not null,
  canonical_url text,
  file_origin text,
  jurisdiction text not null default '',
  topic text not null default '',
  version text not null default '',
  publication_date date,
  effective_date date,
  content_hash text,
  is_reviewed boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'GLOBAL_APPROVED' and practice_id is null) or (scope = 'PRACTICE_PRIVATE' and practice_id is not null))
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  practice_id uuid references public.practices(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  embedding extensions.vector(3072),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, chunk_index)
);

create table public.accreditation_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  title text not null default '',
  requirement_id text references public.accreditation_requirements(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditation_ai_conversation_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  unique (id, practice_id, cycle_id)
);

create table public.accreditation_ai_messages (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  conversation_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  structured_payload jsonb not null default '{}'::jsonb,
  model text,
  openai_response_id text,
  created_at timestamptz not null default now(),
  constraint accreditation_ai_message_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  constraint accreditation_ai_message_conversation_fk
    foreign key (conversation_id, practice_id, cycle_id) references public.accreditation_ai_conversations(id, practice_id, cycle_id) on delete cascade
);

create table public.accreditation_ai_citations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  message_id uuid not null references public.accreditation_ai_messages(id) on delete cascade,
  source_id uuid references public.knowledge_sources(id) on delete set null,
  evidence_id uuid references public.accreditation_evidence(id) on delete set null,
  requirement_id text references public.accreditation_requirements(id) on delete set null,
  citation_label text not null,
  canonical_url text,
  source_title text not null default '',
  publisher text not null default '',
  chunk_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  constraint accreditation_ai_citation_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  check (source_id is not null or evidence_id is not null or requirement_id is not null)
);

create table public.accreditation_review_snapshots (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  snapshot_payload jsonb not null,
  coverage_percent integer not null check (coverage_percent between 0 and 100),
  status_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint accreditation_snapshot_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  unique (id, practice_id, cycle_id)
);

create table public.accreditation_readiness_reports (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  cycle_id uuid not null,
  snapshot_id uuid not null,
  title text not null default 'Accreditation Readiness Report',
  report_payload jsonb not null,
  limitations text[] not null default '{}'::text[],
  generated_by_user_id uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint accreditation_report_cycle_practice_fk
    foreign key (cycle_id, practice_id) references public.accreditation_cycles(id, practice_id) on delete cascade,
  constraint accreditation_report_snapshot_fk
    foreign key (snapshot_id, practice_id, cycle_id) references public.accreditation_review_snapshots(id, practice_id, cycle_id) on delete cascade
);

create index accreditation_evidence_cycle_status_idx on public.accreditation_evidence(practice_id, cycle_id, status, created_at desc);
create index accreditation_evidence_links_requirement_idx on public.accreditation_evidence_requirement_links(practice_id, cycle_id, requirement_id, is_active);
create index accreditation_evidence_assessments_idx on public.accreditation_evidence_assessments(practice_id, cycle_id, requirement_id, is_active);
create index accreditation_processing_jobs_idx on public.accreditation_processing_jobs(practice_id, cycle_id, status, created_at);
create index accreditation_actions_cycle_status_idx on public.accreditation_actions(practice_id, cycle_id, status, due_date);
create index accreditation_team_cycle_idx on public.accreditation_team_members(practice_id, cycle_id, is_active);
create index accreditation_credentials_expiry_idx on public.accreditation_credentials(practice_id, cycle_id, expiry_date);
create index accreditation_training_expiry_idx on public.accreditation_training_records(practice_id, cycle_id, expiry_date);
create index accreditation_ai_messages_conversation_idx on public.accreditation_ai_messages(conversation_id, created_at);
create index accreditation_snapshots_cycle_idx on public.accreditation_review_snapshots(practice_id, cycle_id, created_at desc);
create index accreditation_reports_cycle_idx on public.accreditation_readiness_reports(practice_id, cycle_id, generated_at desc);
create index knowledge_sources_governance_idx on public.knowledge_sources(scope, is_active, is_reviewed);
create index knowledge_chunks_source_idx on public.knowledge_chunks(source_id, chunk_index);

create trigger accreditation_evidence_set_updated_at before update on public.accreditation_evidence
for each row execute function public.set_updated_at();
create trigger accreditation_evidence_links_set_updated_at before update on public.accreditation_evidence_requirement_links
for each row execute function public.set_updated_at();
create trigger accreditation_processing_jobs_set_updated_at before update on public.accreditation_processing_jobs
for each row execute function public.set_updated_at();
create trigger accreditation_team_members_set_updated_at before update on public.accreditation_team_members
for each row execute function public.set_updated_at();
create trigger accreditation_credentials_set_updated_at before update on public.accreditation_credentials
for each row execute function public.set_updated_at();
create trigger accreditation_training_records_set_updated_at before update on public.accreditation_training_records
for each row execute function public.set_updated_at();
create trigger accreditation_actions_set_updated_at before update on public.accreditation_actions
for each row execute function public.set_updated_at();
create trigger knowledge_sources_set_updated_at before update on public.knowledge_sources
for each row execute function public.set_updated_at();
create trigger accreditation_ai_conversations_set_updated_at before update on public.accreditation_ai_conversations
for each row execute function public.set_updated_at();

alter table public.accreditation_evidence enable row level security;
alter table public.accreditation_evidence_requirement_links enable row level security;
alter table public.accreditation_evidence_assessments enable row level security;
alter table public.accreditation_processing_jobs enable row level security;
alter table public.accreditation_actions enable row level security;
alter table public.accreditation_team_members enable row level security;
alter table public.accreditation_credentials enable row level security;
alter table public.accreditation_training_records enable row level security;
alter table public.accreditation_ai_conversations enable row level security;
alter table public.accreditation_ai_messages enable row level security;
alter table public.accreditation_ai_citations enable row level security;
alter table public.accreditation_review_snapshots enable row level security;
alter table public.accreditation_readiness_reports enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;

create policy accreditation_evidence_select_member on public.accreditation_evidence
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_evidence_requirement_links_select_member on public.accreditation_evidence_requirement_links
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_evidence_assessments_select_member on public.accreditation_evidence_assessments
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_processing_jobs_select_member on public.accreditation_processing_jobs
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_actions_select_member on public.accreditation_actions
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_team_members_select_member on public.accreditation_team_members
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_credentials_select_member on public.accreditation_credentials
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_training_records_select_member on public.accreditation_training_records
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_ai_conversations_select_member on public.accreditation_ai_conversations
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_ai_messages_select_member on public.accreditation_ai_messages
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_ai_citations_select_member on public.accreditation_ai_citations
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_review_snapshots_select_member on public.accreditation_review_snapshots
for select to authenticated using (public.is_practice_member(practice_id));
create policy accreditation_readiness_reports_select_member on public.accreditation_readiness_reports
for select to authenticated using (public.is_practice_member(practice_id));

create policy knowledge_sources_select_authorised on public.knowledge_sources
for select to authenticated using (
  (scope = 'GLOBAL_APPROVED' and is_active = true and is_reviewed = true)
  or (scope = 'PRACTICE_PRIVATE' and practice_id is not null and public.is_practice_member(practice_id))
);

create policy knowledge_chunks_select_authorised on public.knowledge_chunks
for select to authenticated using (
  exists (
    select 1
    from public.knowledge_sources source
    where source.id = knowledge_chunks.source_id
      and (
        (source.scope = 'GLOBAL_APPROVED' and source.is_active = true and source.is_reviewed = true)
        or (source.scope = 'PRACTICE_PRIVATE' and source.practice_id is not null and public.is_practice_member(source.practice_id))
      )
  )
);

create or replace function public.match_accreditation_knowledge(
  query_embedding extensions.vector(3072),
  match_count integer default 8,
  source_scope text default 'GLOBAL_APPROVED'
)
returns table (
  chunk_id uuid,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    chunk.id as chunk_id,
    chunk.source_id,
    chunk.content,
    chunk.metadata,
    1 - (chunk.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks chunk
  join public.knowledge_sources source on source.id = chunk.source_id
  where chunk.embedding is not null
    and source.scope = 'GLOBAL_APPROVED'
    and source.is_active = true
    and source.is_reviewed = true
    and (source_scope is null or source_scope = 'GLOBAL_APPROVED')
  order by chunk.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 8), 20));
$$;

revoke all on function public.match_accreditation_knowledge(extensions.vector, integer, text) from public, anon, authenticated;
grant execute on function public.match_accreditation_knowledge(extensions.vector, integer, text) to service_role;

commit;
