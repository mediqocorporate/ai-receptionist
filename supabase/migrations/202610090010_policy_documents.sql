begin;

create table public.practice_documents (
  id uuid primary key default gen_random_uuid(),
  document_group_id uuid not null default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 240),
  document_type text not null check (char_length(btrim(document_type)) between 2 and 240),
  considerations text not null default '',
  content text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'SAVED' check (status in ('DRAFT','SAVED','ARCHIVED')),
  source_template_id text,
  linked_requirement_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index practice_documents_practice_updated_idx
  on public.practice_documents(practice_id, updated_at desc);
create index practice_documents_group_version_idx
  on public.practice_documents(document_group_id, version desc);
create index practice_documents_requirements_idx
  on public.practice_documents using gin(linked_requirement_ids);

create trigger practice_documents_set_updated_at before update on public.practice_documents
for each row execute function public.set_updated_at();

alter table public.practice_documents enable row level security;

create policy practice_documents_select_member on public.practice_documents
for select to authenticated
using (public.is_practice_member(practice_id));

commit;
