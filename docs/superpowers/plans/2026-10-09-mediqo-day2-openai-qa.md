# MediQo Day 2 Production Q&A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the server-side Q&A persistence/quota foundation, OpenAI Responses adapter, and HubSpot-ready CRM outbox while preserving the existing MediQo UI.

**Architecture:** Netlify Functions become the privileged boundary for OpenAI, anonymous quota, Q&A persistence, and CRM sync. Supabase remains identity/tenancy/persistence. The frontend uses the server path when configured and falls back to the existing demo path otherwise.

**Tech Stack:** Vanilla browser ES modules, Node/Netlify Functions, Supabase Postgres/PostgREST/Auth, OpenAI Responses API.

**Spec:** `docs/superpowers/specs/2026-10-09-mediqo-day2-openai-qa-design.md`

## Global Constraints

- Do not expose OpenAI, Supabase service-role, or HubSpot secrets to the browser.
- Anonymous users receive exactly two successful answers.
- Failed model/database calls do not consume the anonymous quota.
- Preserve existing anonymous conversation on account creation.
- HubSpot unavailability must never block account creation or login.
- Do not fabricate citations before RAG is available.
- Keep the current vanilla JS frontend; no React migration.

## Review Focus

- Concurrent anonymous requests cannot exceed two reserved/successful answers.
- A failed OpenAI request releases its reservation.
- An authenticated user cannot attach Q&A to another practice.
- Conversation IDs are actor-bound.
- Missing HubSpot credentials leave a retryable outbox row rather than failing signup.

### Task 1: Database persistence and quota
- Add migration for anonymous sessions, conversations, messages, question logs, sources, CRM outbox.
- Add service-role RPCs for reserve/complete/release/claim/persist.
- Add migration contract tests.

### Task 2: OpenAI and HubSpot server adapters
- Add OpenAI Responses adapter with strict structured output.
- Add HubSpot create/update-by-email adapter that safely returns pending when no token exists.
- Add adapter tests.

### Task 3: Netlify server boundary
- Add Supabase server helper, ask orchestration, `/api/ask`, and `/api/account-sync`.
- Add secure anonymous HttpOnly cookie handling.
- Add tests for quota ordering and authenticated actor resolution.

### Task 4: Frontend wiring and environment
- Add public runtime API route config.
- Update assistant service to use `/api/ask` when configured.
- Update lead service to queue/sync platform accounts.
- Keep deterministic demo fallback.
- Update Netlify redirects and env example from Azure to OpenAI.
- Add regression tests.

### Task 5: Verification and integration
- Run targeted tests and full suite locally where possible.
- Merge branch to `main`.
- User pulls `main`, runs tests/build, then pushes the new Supabase migration.
- Configure OpenAI/Supabase server secrets in Netlify; HubSpot token remains optional.
