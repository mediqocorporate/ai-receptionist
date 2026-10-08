# MediQo Day 2 — Production Q&A, OpenAI and CRM Sync Design

Date: 2026-10-09

## Goal

Replace the remaining demo-only Q&A path with a server-side production path that:
- enforces exactly two successful anonymous answers,
- persists anonymous and authenticated Q&A in Supabase,
- preserves anonymous history when the user creates/signs into an account,
- calls OpenAI from Netlify Functions with the API key kept server-side,
- prepares HubSpot contact sync without blocking signup while HubSpot access is unavailable.

## Existing foundation

Day 1 already provides Supabase Auth, profiles, practices, practice memberships, practice locations, RLS helpers, runtime public config, and real signup/login/logout/email verification.

## Provider decision

The client has changed from Azure OpenAI to the OpenAI API. The production assistant will use the OpenAI Responses API. The default model is `gpt-5.6`; model choice remains environment-configurable. RAG embeddings will later use `text-embedding-3-large`.

## Q&A data model

Add:
- `anonymous_sessions`
- `conversations`
- `messages`
- `question_logs`
- `answer_sources`
- `crm_sync_jobs`

Anonymous sessions store only a hash of an opaque HttpOnly cookie token. The raw token is never stored in Postgres.

## Anonymous quota

Exactly two successful answers are permitted before signup. A request reserves entitlement atomically before the model call. The reservation is consumed only after the answer is generated and persisted. Model/database failures release the reservation so failed calls do not count.

## Authenticated Q&A

Netlify validates the Supabase bearer token, resolves the user's active practice, calls OpenAI, then persists the exchange using the service role. The service-role key is server-only.

## Answer safety

Until RAG lands, live OpenAI answers do not fabricate citations. The backend returns empty `sources` and `relatedResources` arrays. The model is instructed to state uncertainty and tell users to verify current official sources where needed. It must not claim formal accreditation compliance, legal certainty, or clinical certainty.

## History claiming

When an authenticated account sync occurs, the server claims any anonymous session cookie for that user/practice and attaches prior anonymous conversations/question logs to the real account.

## HubSpot

Platform account signup remains Supabase Auth. HubSpot is CRM sync only.

A `crm_sync_jobs` outbox row is created idempotently for each platform account. If `HUBSPOT_ACCESS_TOKEN` is absent, the job remains pending and signup/login still succeeds. When credentials are available, the same endpoint searches by email and creates/updates the HubSpot contact.

## Secrets

Server-only:
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `HUBSPOT_ACCESS_TOKEN`

Browser-safe:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- public API route names only.

No server secret may be emitted into `runtime-config.js`.

## Frontend behavior

When `MEDIQO_ASSISTANT_API_URL` is configured, the browser uses the production ask endpoint and trusts the server for the free-question gate. Otherwise the existing deterministic demo flow remains available.

On server response `signup_required`, the existing signup modal opens and preserves the pending question.

## Non-goals for this batch

- RAG/pgvector knowledge retrieval
- accreditation dataset import
- evidence uploads
- policy generation
- real PMS API integration
- final HubSpot sync validation (credentials unavailable)
