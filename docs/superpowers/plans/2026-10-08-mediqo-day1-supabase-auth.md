# MediQo Day 1 Supabase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production Supabase account and tenancy foundation without rewriting the existing MediQo frontend.

**Architecture:** Keep the browser ES-module application. Add runtime public configuration, a lazy Supabase client, real Auth service, tenant schema/RLS, and minimal UI wiring for signup, sign-in, sign-out and session restoration.

**Tech Stack:** Browser ES modules, Node 20+, Supabase Auth/Postgres/RLS, Supabase JS v2 loaded as a browser ESM module.

**Spec:** `docs/superpowers/specs/2026-10-08-mediqo-day1-supabase-auth-design.md`

## Global Constraints

- Preserve the existing UI and HubSpot embeds.
- Do not migrate to React/TypeScript.
- Do not expose privileged secrets to the browser.
- Keep signup jurisdictions to NSW, VIC, QLD, ACT, WA, SA, NT, TAS.
- Do not hard-code a one-user/one-practice limitation.
- Do not introduce patient-identifiable data fields.
- HubSpot CRM sync is Day 2, not Day 1.

## Review Focus

- Missing Supabase browser config must fail clearly without exposing secrets.
- Signup with email confirmation enabled must not incorrectly mark the user signed in.
- A user from Practice A must not be able to read Practice B tenant rows.
- Retried signup/bootstrap must not create duplicate practice membership for the same new auth user.
- Existing anonymous/demo UI must continue rendering when no Supabase session exists.

---

### Task 1: Runtime Supabase configuration

**Files:**
- Create: `scripts/runtime-config.mjs`
- Modify: `scripts/dev-server.mjs`
- Modify: `scripts/build.mjs`
- Modify: `index.html`
- Modify: `.env.example`
- Modify: `.gitignore`
- Test: `tests/runtime-config.test.mjs`

**Interfaces:**
- Produces: `window.__MEDIQO_CONFIG__` with `supabaseUrl`, `supabaseAnonKey`, `appUrl`.

- [ ] Write failing tests for safe runtime configuration.
- [ ] Run tests and confirm failure.
- [ ] Implement env parsing and runtime-config generation.
- [ ] Wire dev/build/index.
- [ ] Run tests and confirm pass.

### Task 2: Supabase tenant schema and RLS

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202610080001_phase1_foundation.sql`
- Create: `supabase/seed.sql`
- Test: `tests/supabase-foundation.test.mjs`

**Interfaces:**
- Produces: profiles, practices, practice_locations, practice_memberships.
- Produces: `get_current_account_context()` RPC.

- [ ] Write failing migration contract test.
- [ ] Run and confirm failure.
- [ ] Implement schema, signup bootstrap trigger, helper functions and RLS.
- [ ] Run contract test and confirm pass.

### Task 3: Supabase client and auth service

**Files:**
- Create: `src/services/supabase-client.js`
- Modify: `src/services/integration-config.js`
- Modify: `src/services/auth-service.js`
- Test: `tests/auth-service.test.mjs`

**Interfaces:**
- Produces: `authService.createAccount(payload)`, `signIn(credentials)`, `signOut()`, `getCurrentUser()`, `onAuthStateChange(callback)`.

- [ ] Write failing auth service tests.
- [ ] Run and confirm failure.
- [ ] Implement lazy Supabase client and auth adapter.
- [ ] Run auth tests and confirm pass.

### Task 4: Existing UI auth wiring

**Files:**
- Modify: `src/components/dialogs.js`
- Modify: `src/components/shell.js`
- Modify: `src/app.js`
- Test: `tests/auth-ui.test.mjs`
- Test: `tests/auth-wiring.test.mjs`

**Interfaces:**
- Consumes: authService from Task 3.
- Produces: working signup, sign-in, sign-out, session restore.

- [ ] Write failing UI/auth-wiring tests.
- [ ] Run and confirm failure.
- [ ] Add login dialog and sign-in/sign-out actions.
- [ ] Make Supabase session identity the app authority when configured.
- [ ] Remove Riverside Medical Centre as signup field value; keep it only as placeholder.
- [ ] Run targeted tests and syntax checks.
- [ ] Run full project tests/build/smoke where environment permits.
