begin;

create table public.anonymous_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  successful_answer_count smallint not null default 0 check (successful_answer_count between 0 and 2),
  reserved_answer_count smallint not null default 0 check (reserved_answer_count between 0 and 2),
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references public.practices(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_session_id uuid references public.anonymous_sessions(id) on delete set null,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_actor_present check (
    (user_id is not null and practice_id is not null) or anonymous_session_id is not null
  )
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.question_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  practice_id uuid references public.practices(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_session_id uuid references public.anonymous_sessions(id) on delete set null,
  question text not null,
  answer_text text not null,
  answer_json jsonb not null default '{}'::jsonb,
  model text,
  openai_response_id text,
  status text not null default 'answered' check (status in ('answered','failed')),
  created_at timestamptz not null default now()
);

create table public.answer_sources (
  id uuid primary key default gen_random_uuid(),
  question_log_id uuid not null references public.question_logs(id) on delete cascade,
  position smallint not null default 0,
  title text not null,
  publisher text,
  url text,
  source_ref text,
  created_at timestamptz not null default now()
);

create table public.crm_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references public.practices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','synced','failed')),
  attempt_count integer not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_type)
);

create index conversations_user_idx on public.conversations(user_id, created_at desc);
create index conversations_practice_idx on public.conversations(practice_id, created_at desc);
create index conversations_anon_idx on public.conversations(anonymous_session_id, created_at desc);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
create index question_logs_user_idx on public.question_logs(user_id, created_at desc);
create index question_logs_practice_idx on public.question_logs(practice_id, created_at desc);
create index question_logs_anon_idx on public.question_logs(anonymous_session_id, created_at desc);
create index answer_sources_question_idx on public.answer_sources(question_log_id, position);
create index crm_sync_jobs_status_idx on public.crm_sync_jobs(status, created_at);

create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

create trigger crm_sync_jobs_set_updated_at before update on public.crm_sync_jobs
for each row execute function public.set_updated_at();

create or replace function public.reserve_anonymous_answer(p_token_hash text)
returns table(session_id uuid, allowed boolean, remaining_after_reservation integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.anonymous_sessions%rowtype;
begin
  insert into public.anonymous_sessions(token_hash)
  values (p_token_hash)
  on conflict (token_hash) do update set last_seen_at = now();

  select * into session_row
  from public.anonymous_sessions
  where token_hash = p_token_hash
  for update;

  if session_row.claimed_by_user_id is not null
     or session_row.successful_answer_count + session_row.reserved_answer_count >= 2 then
    return query select session_row.id, false, greatest(0, 2 - session_row.successful_answer_count - session_row.reserved_answer_count);
    return;
  end if;

  update public.anonymous_sessions
  set reserved_answer_count = reserved_answer_count + 1,
      last_seen_at = now()
  where id = session_row.id;

  return query select session_row.id, true, greatest(0, 1 - session_row.successful_answer_count - session_row.reserved_answer_count);
end;
$$;

create or replace function public.complete_anonymous_answer(p_session_id uuid)
returns table(successful_count integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.anonymous_sessions%rowtype;
begin
  select * into session_row from public.anonymous_sessions where id = p_session_id for update;
  if not found then raise exception 'anonymous_session_not_found'; end if;
  if session_row.reserved_answer_count < 1 then raise exception 'anonymous_answer_not_reserved'; end if;

  update public.anonymous_sessions
  set reserved_answer_count = reserved_answer_count - 1,
      successful_answer_count = successful_answer_count + 1,
      last_seen_at = now()
  where id = p_session_id
  returning * into session_row;

  return query select session_row.successful_answer_count::integer, greatest(0, 2 - session_row.successful_answer_count)::integer;
end;
$$;

create or replace function public.release_anonymous_answer(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.anonymous_sessions
  set reserved_answer_count = greatest(0, reserved_answer_count - 1),
      last_seen_at = now()
  where id = p_session_id;
end;
$$;

create or replace function public.claim_anonymous_session(p_token_hash text, p_user_id uuid, p_practice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  session_id_value uuid;
begin
  if not exists (
    select 1 from public.practice_memberships
    where user_id = p_user_id and practice_id = p_practice_id and status = 'active'
  ) then
    raise exception 'practice_membership_required';
  end if;

  select id into session_id_value
  from public.anonymous_sessions
  where token_hash = p_token_hash
  for update;

  if session_id_value is null then return null; end if;

  update public.anonymous_sessions
  set claimed_by_user_id = p_user_id, claimed_at = coalesce(claimed_at, now()), last_seen_at = now()
  where id = session_id_value;

  update public.conversations
  set user_id = p_user_id, practice_id = p_practice_id
  where anonymous_session_id = session_id_value and user_id is null;

  update public.question_logs
  set user_id = p_user_id, practice_id = p_practice_id
  where anonymous_session_id = session_id_value and user_id is null;

  return session_id_value;
end;
$$;

create or replace function public.persist_question_answer(
  p_conversation_id uuid,
  p_user_id uuid,
  p_practice_id uuid,
  p_anonymous_session_id uuid,
  p_question text,
  p_answer_text text,
  p_answer_json jsonb,
  p_model text,
  p_openai_response_id text
)
returns table(conversation_id uuid, question_log_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id_value uuid;
  question_log_id_value uuid;
  existing public.conversations%rowtype;
begin
  if p_user_id is not null then
    if p_practice_id is null or not exists (
      select 1 from public.practice_memberships
      where user_id = p_user_id and practice_id = p_practice_id and status = 'active'
    ) then
      raise exception 'practice_membership_required';
    end if;
  elsif p_anonymous_session_id is null then
    raise exception 'conversation_actor_required';
  end if;

  if p_conversation_id is not null then
    select * into existing from public.conversations where id = p_conversation_id for update;
    if not found then raise exception 'conversation_not_found'; end if;

    if p_user_id is not null then
      if existing.user_id is distinct from p_user_id or existing.practice_id is distinct from p_practice_id then
        raise exception 'conversation_access_denied';
      end if;
    elsif existing.anonymous_session_id is distinct from p_anonymous_session_id then
      raise exception 'conversation_access_denied';
    end if;

    conversation_id_value := existing.id;
  else
    insert into public.conversations(practice_id, user_id, anonymous_session_id, title)
    values (
      p_practice_id,
      p_user_id,
      p_anonymous_session_id,
      left(regexp_replace(btrim(p_question), '\s+', ' ', 'g'), 120)
    )
    returning id into conversation_id_value;
  end if;

  insert into public.messages(conversation_id, role, content)
  values
    (conversation_id_value, 'user', p_question),
    (conversation_id_value, 'assistant', p_answer_text);

  insert into public.question_logs(
    conversation_id, practice_id, user_id, anonymous_session_id,
    question, answer_text, answer_json, model, openai_response_id, status
  ) values (
    conversation_id_value, p_practice_id, p_user_id, p_anonymous_session_id,
    p_question, p_answer_text, coalesce(p_answer_json, '{}'::jsonb), p_model, p_openai_response_id, 'answered'
  ) returning id into question_log_id_value;

  return query select conversation_id_value, question_log_id_value;
end;
$$;

revoke all on function public.reserve_anonymous_answer(text) from public;
revoke all on function public.complete_anonymous_answer(uuid) from public;
revoke all on function public.release_anonymous_answer(uuid) from public;
revoke all on function public.claim_anonymous_session(text, uuid, uuid) from public;
revoke all on function public.persist_question_answer(uuid, uuid, uuid, uuid, text, text, jsonb, text, text) from public;

grant execute on function public.reserve_anonymous_answer(text) to service_role;
grant execute on function public.complete_anonymous_answer(uuid) to service_role;
grant execute on function public.release_anonymous_answer(uuid) to service_role;
grant execute on function public.claim_anonymous_session(text, uuid, uuid) to service_role;
grant execute on function public.persist_question_answer(uuid, uuid, uuid, uuid, text, text, jsonb, text, text) to service_role;

alter table public.anonymous_sessions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.question_logs enable row level security;
alter table public.answer_sources enable row level security;
alter table public.crm_sync_jobs enable row level security;

create policy conversations_select_own on public.conversations
for select to authenticated
using (user_id = auth.uid() and public.is_practice_member(practice_id));

create policy messages_select_own_conversation on public.messages
for select to authenticated
using (exists (
  select 1 from public.conversations c
  where c.id = conversation_id and c.user_id = auth.uid() and public.is_practice_member(c.practice_id)
));

create policy question_logs_select_own on public.question_logs
for select to authenticated
using (user_id = auth.uid() and public.is_practice_member(practice_id));

create policy answer_sources_select_own on public.answer_sources
for select to authenticated
using (exists (
  select 1 from public.question_logs q
  where q.id = question_log_id and q.user_id = auth.uid() and public.is_practice_member(q.practice_id)
));

commit;
