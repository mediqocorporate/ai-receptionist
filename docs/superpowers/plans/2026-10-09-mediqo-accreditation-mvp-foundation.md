# MediQo Accreditation MVP Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current illustrative accreditation demo with a source-backed RACGP 5th Edition MVP driven by Elly's accreditation brief and readiness workbook, with persisted Quick Check responses and conservative server-side assessment.

**Architecture:** Keep accreditation configuration and practice state in Supabase, expose it through one authenticated Netlify Function, and make the browser render server assessment output rather than calculate readiness. A deterministic workbook importer produces version-controlled normalized JSON and SQL so the client spreadsheet remains traceable and repeatable.

**Tech Stack:** Vanilla browser ES modules, Node 20+, Netlify Functions, Supabase/Postgres/RLS, Node test runner, `exceljs@4.4.0` for build-time workbook import.

**Spec:** `docs/superpowers/specs/2026-10-09-mediqo-accreditation-mvp-foundation-design.md`

## Global Constraints

- Current formal workspace: **RACGP Standards for general practices — 5th edition**.
- Future 6th-edition readiness remains separate and must not affect current formal readiness.
- Allowed readiness states: `APPEARS_READY`, `NEEDS_ATTENTION`, `CONFIRMED_GAP`, `NOT_CHECKED`.
- Verification is separate: `USER_REPORTED`, `EVIDENCE_UPLOADED`, `AI_REVIEWED`, `MANUALLY_VERIFIED`.
- Never use pass/fail/compliant/certified language.
- Frontend must not calculate accreditation readiness.
- `RACGP5-QI2-1C` is HOLD and inactive.
- VALIDATE rows must remain explicitly unverified; do not infer Mandatory/Aspirational.
- Unknown / “I'm not sure” must remain `NOT_CHECKED`.
- Controlled accreditation configuration is browser read-only.
- Practice state is tenant-scoped using existing membership helpers.

## Review Focus

1. A VALIDATE or HOLD row must never be counted as verified mandatory readiness; dataset tests pin this in Task 1.
2. A user answering “Yes” must not automatically become `APPEARS_READY`; assessment tests pin this in Task 3.
3. “I'm not sure” must remain `NOT_CHECKED`, not a failure or gap; assessment tests pin this in Task 3.
4. A user from Practice A must not be able to read or mutate Practice B accreditation state; RLS and handler tests pin this in Tasks 2 and 4.
5. Refresh/sign-in must restore cycle progress without frontend recomputation; service/component tests pin this in Tasks 4 and 5.

---

### Task 1: Normalize Elly's accreditation workbook into controlled build assets

**Files:**
- Create: `scripts/import-accreditation-dataset.mjs`
- Create: `data/accreditation/source/MediQo_Accreditation_MVP_Readiness_Question_Dataset.xlsx`
- Create: `data/accreditation/generated/accreditation-dataset.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/accreditation-dataset.test.mjs`

**Interfaces:**
- Consumes: workbook sheets `README`, `Requirements`, `Questions`, `Answer Options`, `Branching Logic`, `Evidence Criteria`, `Sources`.
- Produces: `importAccreditationWorkbook(path) -> { meta, requirements, questions, answerOptions, branchingRules, evidenceCriteria, sources }` and checked-in normalized JSON.

- [ ] **Step 1: Write the failing dataset tests**
  - Assert seven required sheets exist.
  - Assert 125 requirement rows.
  - Assert 55 verified Mandatory, 6 verified Aspirational, 64 VALIDATE.
  - Assert priorities P1=20, P2=30, P3=75.
  - Assert 20 critical-safety rows.
  - Assert `RACGP5-QI2-1C` is HOLD/inactive.
  - Assert duplicate IDs and broken question→requirement references throw.
  - Assert unsupported classification text throws rather than guessing.

- [ ] **Step 2: Run the dataset test and verify RED**

Run: `node --test tests/accreditation-dataset.test.mjs`

Expected: FAIL because importer/generated asset do not exist.

- [ ] **Step 3: Add the workbook importer**

Add `exceljs@4.4.0` as a dev dependency. Implement exact sheet/column validation, controlled classification mapping, pipe-delimited normalization, referential-integrity checks, HOLD handling, and deterministic JSON ordering.

- [ ] **Step 4: Generate and inspect the normalized dataset**

Run: `node scripts/import-accreditation-dataset.mjs data/accreditation/source/MediQo_Accreditation_MVP_Readiness_Question_Dataset.xlsx data/accreditation/generated/accreditation-dataset.json`

Expected: summary prints the exact row/status counts from Step 1 and exits 0.

- [ ] **Step 5: Run the dataset tests and full suite**

Run: `npm test`

Expected: PASS with the new dataset tests included.

- [ ] **Step 6: Commit**

`git add package.json package-lock.json scripts/import-accreditation-dataset.mjs data/accreditation tests/accreditation-dataset.test.mjs && git commit -m "feat: normalize accreditation workbook dataset"`

---

### Task 2: Add Supabase accreditation schema, controlled dataset tables and tenant RLS

**Files:**
- Create: `supabase/migrations/202610090002_accreditation_foundation.sql`
- Create: `scripts/generate-accreditation-sql.mjs`
- Create: `supabase/migrations/202610090003_accreditation_racgp5_dataset.sql`
- Test: `tests/accreditation-migration.test.mjs`

**Interfaces:**
- Consumes: normalized dataset JSON from Task 1.
- Produces: controlled knowledge tables plus practice-scoped `accreditation_cycles`, `practice_requirements`, `readiness_responses`.

- [ ] **Step 1: Write failing migration tests**
  - Assert all controlled/config and practice-state tables exist.
  - Assert the four readiness statuses and four verification statuses are enforced by constraints.
  - Assert RLS is enabled on all practice-scoped tables.
  - Assert policies use existing `is_practice_member` / `has_practice_role` helpers.
  - Assert controlled tables have authenticated SELECT but no browser INSERT/UPDATE/DELETE policy.
  - Assert current RACGP 5th edition standard version is seeded and HOLD rows are inactive.

- [ ] **Step 2: Run migration tests and verify RED**

Run: `node --test tests/accreditation-migration.test.mjs`

Expected: FAIL because migrations do not exist.

- [ ] **Step 3: Implement the schema migration**

Create controlled tables for standard versions, requirements, questions, answer options, branching, evidence criteria and sources; create tenant tables for cycles, practice requirements and readiness responses; add indexes, timestamps and RLS.

- [ ] **Step 4: Implement deterministic SQL generation**

Implement `generateAccreditationSql(dataset) -> string` in `scripts/generate-accreditation-sql.mjs`; output idempotent inserts/upserts for controlled data only and never modify prior applied migrations.

- [ ] **Step 5: Generate the dataset migration**

Run: `node scripts/generate-accreditation-sql.mjs data/accreditation/generated/accreditation-dataset.json supabase/migrations/202610090003_accreditation_racgp5_dataset.sql`

Expected: generated SQL contains all active/non-HOLD requirement records and linked configuration.

- [ ] **Step 6: Run migration tests and full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

`git add supabase/migrations scripts/generate-accreditation-sql.mjs tests/accreditation-migration.test.mjs && git commit -m "feat: add accreditation Supabase foundation"`

---

### Task 3: Build the deterministic accreditation assessment engine

**Files:**
- Create: `netlify/functions/_shared/accreditation-assessment.mjs`
- Test: `tests/accreditation-assessment.test.mjs`

**Interfaces:**
- Produces: `assessRequirement({ requirement, question, response, previousState }) -> { applicabilityStatus, readinessStatus, verificationStatus, confidence, statusReason, knownFacts, unknownFacts, potentialGaps, confirmedGaps, recommendedActions, requiresReassessment }`.

- [ ] **Step 1: Write failing assessment tests**
  - Unknown / “I'm not sure” → `NOT_CHECKED`.
  - Positive user report → `USER_REPORTED` and not automatically `APPEARS_READY`.
  - Explicit negative answer to an applicable verified required element → `CONFIRMED_GAP`.
  - Partial/incomplete answer only yields `NEEDS_ATTENTION` when configured semantics directly support it.
  - HOLD → no active assessment.
  - Missing/ambiguous rule → `NOT_CHECKED` with “More information required”.
  - VALIDATE classification never becomes verified mandatory/aspirational readiness.

- [ ] **Step 2: Run assessment tests and verify RED**

Run: `node --test tests/accreditation-assessment.test.mjs`

Expected: FAIL because engine does not exist.

- [ ] **Step 3: Implement the minimal deterministic engine**

Do not call OpenAI. Only use controlled configuration and explicit user response semantics. Return the exact output shape above.

- [ ] **Step 4: Run assessment tests and full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add netlify/functions/_shared/accreditation-assessment.mjs tests/accreditation-assessment.test.mjs && git commit -m "feat: add conservative accreditation assessment engine"`

---

### Task 4: Add authenticated accreditation API and Supabase persistence

**Files:**
- Create: `netlify/functions/accreditation.mjs`
- Modify: `netlify/functions/_shared/supabase-server.mjs`
- Modify: `netlify.toml`
- Modify: `scripts/runtime-config.mjs`
- Modify: `.env.example`
- Test: `tests/accreditation-function.test.mjs`
- Test: `tests/accreditation-server.test.mjs`

**Interfaces:**
- Browser endpoint: `POST /api/accreditation`.
- Actions:
  - `{ action: "overview" }` → cycle, coverage, assessed-readiness distribution, next question/action.
  - `{ action: "answer", cycleId, questionId, answerLabel, answerDetail? }` → persisted response + re-assessed requirement + updated overview.
  - `{ action: "requirement", requirementId, cycleId? }` → requirement detail object.
- Authentication: Supabase bearer token required.

- [ ] **Step 1: Write failing handler/server tests**
  - Missing/invalid session → 401.
  - Actor practice is always taken from authenticated context, never request body.
  - Overview creates/resumes one active RACGP5 current cycle for the actor's practice.
  - Answer persists actor user/practice/cycle/question/timestamp and assessment output.
  - Requirement detail returns only active/non-HOLD controlled config plus actor-practice state.
  - Practice A cannot select/update Practice B records even when malicious IDs are supplied.

- [ ] **Step 2: Run handler tests and verify RED**

Run: `node --test tests/accreditation-function.test.mjs tests/accreditation-server.test.mjs`

Expected: FAIL because endpoint/server methods do not exist.

- [ ] **Step 3: Extend Supabase server adapter**

Add focused methods: `getOrCreateAccreditationCycle`, `getAccreditationOverview`, `getAccreditationRequirement`, `saveReadinessResponse`, `upsertPracticeRequirementAssessment`, each taking the authenticated `practiceId` explicitly.

- [ ] **Step 4: Implement the Netlify function**

Authenticate first, validate action payloads, call the deterministic assessment engine, persist results, and return only presentation-ready objects.

- [ ] **Step 5: Add runtime route/config**

Add `MEDIQO_ACCREDITATION_API_URL=/api/accreditation`, browser-safe runtime config key, and Netlify rewrite.

- [ ] **Step 6: Run targeted tests, full suite, build and smoke**

Run: `npm test && npm run build && npm run smoke`

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

`git add netlify/functions scripts/runtime-config.mjs netlify.toml .env.example tests/accreditation-*.test.mjs && git commit -m "feat: add accreditation API and persistence"`

---

### Task 5: Replace the demo accreditation page with the real RACGP5 workspace

**Files:**
- Create: `src/services/accreditation-service.js`
- Create: `src/components/accreditation/overview.js`
- Create: `src/components/accreditation/readiness-check.js`
- Create: `src/components/accreditation/requirements.js`
- Create: `src/components/accreditation/requirement-detail.js`
- Create: `src/components/accreditation/status.js`
- Modify: `src/components/accreditation.js`
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Remove after migration: `src/data/accreditation.js`
- Test: `tests/accreditation-ui.test.mjs`
- Test: `tests/accreditation-service.test.mjs`

**Interfaces:**
- `accreditationService.overview()`
- `accreditationService.answer({ cycleId, questionId, answerLabel, answerDetail })`
- `accreditationService.requirement({ requirementId, cycleId })`
- Components consume server presentation objects only; they do not infer readiness.

- [ ] **Step 1: Write failing service/UI tests**
  - Page shows “RACGP 5th edition”.
  - Only the four approved readiness labels render.
  - No “Ready”, “Action required”, “Expiring soon”, pass/fail/compliant/certified wording remains in accreditation UI.
  - Empty/new practice shows setup/Not Checked states rather than fake readiness percentages.
  - Overview displays coverage separately from assessed readiness.
  - P1 Quick Check renders one server-selected question at a time and includes “I'm not sure”.
  - Requirements filters include All, four statuses, P1, Critical safety.
  - VALIDATE rows show “Validation required”.
  - Requirement detail renders source, known/unknown facts, evidence criteria, response and next action from server data.
  - Refresh/init calls `overview()` and restores persisted progress.

- [ ] **Step 2: Run service/UI tests and verify RED**

Run: `node --test tests/accreditation-service.test.mjs tests/accreditation-ui.test.mjs`

Expected: FAIL because live accreditation service/components do not exist.

- [ ] **Step 3: Implement the browser service**

Use the existing Supabase session to send bearer auth to `accreditationApiUrl`; map server errors into safe UI messages.

- [ ] **Step 4: Implement the accreditation workspace components**

Build Overview, Readiness Check, Requirements and Requirement Detail as server-driven views. Preserve the existing MediQo visual language; no fake metrics.

- [ ] **Step 5: Wire state/actions in `src/app.js`**

On `/accreditation`, load overview for signed-in users, support view/filter/question/detail actions, save answers through the service, and refresh server state after each answer.

- [ ] **Step 6: Remove the old hard-coded readiness calculation and demo dataset**

Delete `src/data/accreditation.js` references and any frontend status calculation based on selected values.

- [ ] **Step 7: Run targeted tests, full suite, build and smoke**

Run: `npm test && npm run build && npm run smoke`

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

`git add src tests && git commit -m "feat: build live accreditation readiness workspace"`

---

### Task 6: Final accreditation safety/tenant regression pass and release handoff

**Files:**
- Modify: `tests/client-final-demo.test.mjs`
- Create: `tests/accreditation-release-blockers.test.mjs`
- Modify: `README.md`

**Interfaces:**
- No new runtime interfaces; this task locks the acceptance criteria.

- [ ] **Step 1: Add release-blocker regression tests**
  - HOLD requirement never appears as active.
  - VALIDATE never silently becomes Mandatory/Aspirational.
  - User-reported positive answer is not certified/“ready” by frontend.
  - Unknown remains Not Checked.
  - Tenant identifiers cannot be overridden from client payloads.
  - Current RACGP5 workspace is distinct from future-readiness version records.

- [ ] **Step 2: Run the full verification suite**

Run: `npm test && npm run build && npm run smoke`

Expected: all commands exit 0.

- [ ] **Step 3: Document local environment and migration steps**

README must include:
- `MEDIQO_ACCREDITATION_API_URL=/api/accreditation`
- `npx supabase db push`
- local Netlify dev command
- workbook regeneration command
- warning that VALIDATE/HOLD content is not production-certified accreditation advice.

- [ ] **Step 4: Commit**

`git add tests README.md && git commit -m "test: lock accreditation MVP safety rules"`

- [ ] **Step 5: Apply remote migration only after local verification**

User-side command after pulling main:

`npx supabase db push`

Expected: only new accreditation migrations are listed/applied.

- [ ] **Step 6: Browser acceptance check**

Verify signed-in flow:
1. Accreditation Assistant opens RACGP 5th Edition workspace.
2. Start/resume Quick Check.
3. Answer one positive, one negative, one “I'm not sure”.
4. Coverage changes independently from readiness.
5. Requirement detail shows dataset source/evidence configuration.
6. Refresh retains progress.
7. No pass/fail/compliant/certified claims appear.
