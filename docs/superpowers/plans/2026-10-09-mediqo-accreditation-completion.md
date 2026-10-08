# MediQo Accreditation Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Elly's RACGP 5th Edition Accreditation Assistant with evidence, source-backed AI, gaps/actions/team workflows, and a persisted readiness report while preserving the existing conservative assessment rules.

**Architecture:** Keep the current vanilla ES-module frontend, Supabase Auth/Postgres/RLS, Netlify Functions and OpenAI server-side architecture. Add focused accreditation subsystems around the existing assessment engine instead of expanding the current `accreditation.mjs` into a monolith; every browser view consumes server-derived objects and never computes readiness itself.

**Tech Stack:** Vanilla JavaScript ES modules, Node 20+, Netlify Functions, Supabase Postgres/Auth/Storage/pgvector, OpenAI Responses API + embeddings, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-09-mediqo-accreditation-completion-design.md`

## Global Constraints

- Current formal workspace is **RACGP Standards for general practices — 5th edition**.
- Future 6th Edition readiness remains a separate workspace.
- Readiness states are only `APPEARS_READY`, `NEEDS_ATTENTION`, `CONFIRMED_GAP`, `NOT_CHECKED`.
- Verification states remain separate: `USER_REPORTED`, `EVIDENCE_UPLOADED`, `AI_REVIEWED`, `MANUALLY_VERIFIED`.
- Never claim pass, fail, compliant, certified, guaranteed accreditation outcome, or current regulatory status without freshness support.
- Frontend never calculates accreditation readiness.
- VALIDATE rows remain unverified; HOLD rows remain inactive.
- Deleted/superseded evidence cannot continue supporting readiness.
- Private practice evidence is tenant-scoped; global approved knowledge is read-only.
- Service-role and OpenAI operations remain server-only.
- Do not intentionally collect patient-identifiable information in this accreditation MVP.
- Preserve the current vanilla JavaScript application; do not migrate to React/TypeScript.
- Hide the global Reports navigation item; Accreditation Readiness Report lives inside Accreditation Assistant.
- Use TDD for every behavioral change and run `npm test && npm run build && npm run smoke` before merging a completed batch.

## Review Focus

1. **Evidence deletion/supersession:** a requirement previously supported by evidence must be re-assessed without that evidence; Task 4 tests this explicitly.
2. **Cross-practice file retrieval:** Practice A must never obtain Practice B evidence metadata, signed URLs, extracted text or AI citations; Tasks 2, 3 and 5 test this.
3. **Unsupported/failed extraction:** the evidence remains stored but status is Not Reviewed / More information required, with no readiness mutation; Tasks 3 and 4 test this.
4. **Citation integrity:** every Accreditation Assistant citation must correspond to retrieved approved knowledge or authorised practice evidence; Task 5 tests this.
5. **Completed actions/reports:** completing an action or generating a report must not independently upgrade readiness; Tasks 6 and 7 test this.

---

## Live brief corrections folded in after Elly source recheck

The live Google Doc Build Brief adds MVP work that was not explicit enough in the first approved plan. Treat these as binding additions, not optional polish:

- First-visit experience when no accreditation cycle exists.
- Functional Explore Accreditation Assistant tour using clearly labelled fictional Example Practice data that never writes to the user's real practice.
- Accreditation setup wizard covering journey status, assessment date, accrediting agency and practice context without forcing unknown answers.
- Entry choice to Quick Check, Comprehensive Check or Upload Documents.
- Practice Information view showing the facts MediQo relies on and their provenance.
- Obvious back navigation on every accreditation page.
- Comprehensive assessment path that ultimately maps to every applicable mandatory indicator; aspirational indicators remain visually separate.
- Evidence Library supports multiple upload and classification correction.
- Every gap/unknown/status has a direct next action; no dead clickable controls.
- Readiness Report makes incomplete coverage impossible to overlook and preserves snapshots/history.
- Exportable evidence/readiness material must remain traceable to current practice state and sources.
- Assessment-date countdown is shown only when a real date is known.
- 6th Edition remains P2/future and separate from the current formal workspace.

### Task 1A: First visit, Explore tour and setup wizard

**Files:**
- Create: `src/components/accreditation/explore.js`
- Create: `src/components/accreditation/setup.js`
- Create: `src/components/accreditation/practice-information.js`
- Modify: `src/components/accreditation.js`
- Modify: `src/app.js`
- Modify: `src/services/accreditation-service.js`
- Modify: `netlify/functions/accreditation.mjs`
- Modify: `netlify/functions/_shared/supabase-server.mjs`
- Modify: `src/styles.css`
- Test: `tests/accreditation-first-visit.test.mjs`
- Test: `tests/accreditation-explore.test.mjs`
- Test: `tests/accreditation-setup.test.mjs`

**Interfaces:**
- First visit without a cycle renders “Let's get your practice ready for accreditation.” with functional `Set up my accreditation` and `Explore Accreditation Assistant`.
- Explore uses `demo_mode=true` and fictional Riverside Medical Centre data only; no write endpoint accepts demo state.
- Setup stores only answered facts and never invents assessment dates/countdowns.
- Setup completion offers Quick Check, Comprehensive Check, or Upload Documents.
- Practice Information returns value + provenance fields for every fact used in applicability/readiness.

- [ ] **Step 1: Write failing first-visit/explore/setup tests**
- [ ] **Step 2: Run targeted tests and verify RED**
- [ ] **Step 3: Implement server cycle/setup/practice-profile interfaces**
- [ ] **Step 4: Implement Explore and setup UI with functional back navigation and no dead CTA**
- [ ] **Step 5: Run `npm test && npm run build && npm run smoke`**
- [ ] **Step 6: Commit `feat: add accreditation explore and setup flows`**

### Task 1B: Comprehensive readiness path and Practice Information provenance

**Files:**
- Create: `src/components/accreditation/comprehensive-check.js`
- Modify: `netlify/functions/_shared/supabase-server.mjs`
- Modify: `netlify/functions/accreditation.mjs`
- Modify: `src/services/accreditation-service.js`
- Modify: `src/components/accreditation.js`
- Modify: `src/app.js`
- Test: `tests/accreditation-comprehensive-check.test.mjs`
- Test: `tests/accreditation-practice-information.test.mjs`

**Interfaces:**
- Comprehensive check returns the next server-selected unanswered question across applicable/needs-confirmation mandatory indicators, keeping aspirational items separate.
- Practice Information exposes the facts and provenance that drive applicability.
- Unknown applicability remains Needs confirmation / Not Checked and cannot be silently marked N/A.

- [ ] **Step 1: Write failing comprehensive/provenance tests**
- [ ] **Step 2: Run targeted tests and verify RED**
- [ ] **Step 3: Implement server-driven comprehensive question selection and provenance reads**
- [ ] **Step 4: Implement UI and re-assessment hooks**
- [ ] **Step 5: Run `npm test && npm run build && npm run smoke`**
- [ ] **Step 6: Commit `feat: add comprehensive accreditation assessment`**

### Task 1: Client-ready accreditation navigation and copy polish

**Files:**
- Modify: `src/data/routes.js`
- Modify: `src/components/accreditation.js`
- Modify: `src/components/accreditation/overview.js`
- Modify: `src/components/accreditation/readiness-check.js`
- Modify: `src/components/accreditation/requirement-detail.js`
- Modify: `src/styles.css`
- Modify: `src/app.js`
- Test: `tests/accreditation-ui.test.mjs`
- Test: `tests/client-final-demo.test.mjs`

**Interfaces:**
- Consumes: existing `renderAccreditationPage(state, options)`.
- Produces: internal views `overview | check | requirements | evidence | missing | actions | team | assistant | report` with placeholder-safe empty states for not-yet-loaded modules.

- [ ] **Step 1: Write failing UI tests**
  - `APP_ROUTES` does not contain `/reports`.
  - Accreditation tabs include Evidence, What's Missing, Actions, Team, Ask Accreditation Assistant and Readiness Report.
  - Completed Quick Check says Review Quick Check.
  - Requirement detail avoids developer wording such as “Plain-English readiness assessment”.
  - No accreditation component renders prohibited pass/fail/compliant/certified copy.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `node --test tests/accreditation-ui.test.mjs tests/client-final-demo.test.mjs`

Expected: FAIL because the new tabs/copy/hide-Reports behavior is not fully present.

- [ ] **Step 3: Implement the navigation/copy changes**
  - Remove Reports from `APP_ROUTES` but leave the old route renderer unreachable for backward compatibility during this batch.
  - Add accreditation tab definitions in `src/components/accreditation.js`.
  - Keep empty/loading states clear and Practice Manager-oriented.
  - Do not add fake metrics/data to empty modules.

- [ ] **Step 4: Run targeted tests and full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/data/routes.js src/components/accreditation* src/styles.css src/app.js tests && git commit -m "feat: polish accreditation workspace navigation"`

---

### Task 2: Add evidence, actions, team, report and knowledge database foundation

**Files:**
- Create: `supabase/migrations/202610090004_accreditation_completion_foundation.sql`
- Test: `tests/accreditation-completion-migration.test.mjs`

**Interfaces:**
- Produces these tables:
  - `accreditation_evidence`
  - `accreditation_evidence_requirement_links`
  - `accreditation_evidence_assessments`
  - `accreditation_processing_jobs`
  - `accreditation_actions`
  - `accreditation_team_members`
  - `accreditation_credentials`
  - `accreditation_training_records`
  - `accreditation_ai_conversations`
  - `accreditation_ai_messages`
  - `accreditation_ai_citations`
  - `accreditation_review_snapshots`
  - `accreditation_readiness_reports`
  - `knowledge_sources`
  - `knowledge_chunks`
- Produces private Storage bucket `accreditation-evidence`.
- Produces pgvector extension and retrieval RPC `match_accreditation_knowledge(query_embedding vector(3072), match_count int, source_scope text)`.

- [ ] **Step 1: Write failing migration tests**
  - All tables above exist with `practice_id`/cycle scoping where private.
  - Evidence status is constrained to ACTIVE/SUPERSEDED/ARCHIVED.
  - Evidence review status is constrained to SUFFICIENT_FOR_REVIEW/INCOMPLETE/OUTDATED/CONFLICTING/NOT_REVIEWED/MORE_INFORMATION_REQUIRED.
  - Actions use OPEN/IN_PROGRESS/BLOCKED/DONE.
  - Private tables have RLS and authenticated SELECT only through `is_practice_member`.
  - Browser INSERT/UPDATE/DELETE policies do not exist for server-controlled assessment/evidence-review tables.
  - Storage bucket is private.
  - `knowledge_sources` includes reviewed/active fields and scope.
  - `knowledge_chunks.embedding` is `vector(3072)`.

- [ ] **Step 2: Run the migration test and verify RED**

Run: `node --test tests/accreditation-completion-migration.test.mjs`

Expected: FAIL because migration 004 does not exist.

- [ ] **Step 3: Implement migration 004**
  - Use existing practice/cycle composite FK patterns.
  - Add useful indexes by practice/cycle/status/requirement.
  - Add `set_updated_at` triggers where records mutate.
  - Seed `knowledge_sources` metadata from the existing controlled accreditation source catalogue only; do not invent source content.

- [ ] **Step 4: Run migration/full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add supabase/migrations/202610090004_accreditation_completion_foundation.sql tests/accreditation-completion-migration.test.mjs && git commit -m "feat: add accreditation completion schema"`

---

### Task 3: Secure evidence upload, metadata, mapping and Evidence UI

**Files:**
- Create: `netlify/functions/accreditation-evidence.mjs`
- Create: `netlify/functions/_shared/accreditation-evidence.mjs`
- Modify: `netlify/functions/_shared/supabase-server.mjs`
- Create: `src/services/accreditation-evidence-service.js`
- Create: `src/components/accreditation/evidence.js`
- Modify: `src/components/accreditation.js`
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Modify: `netlify.toml`
- Modify: `scripts/runtime-config.mjs`
- Modify: `.env.example`
- Test: `tests/accreditation-evidence-function.test.mjs`
- Test: `tests/accreditation-evidence-server.test.mjs`
- Test: `tests/accreditation-evidence-ui.test.mjs`

**Interfaces:**
- Browser route: `POST /api/accreditation-evidence`.
- Actions:
  - `list` → evidence list for authenticated practice/cycle.
  - `prepareUpload({ cycleId, filename, mimeType, sizeBytes, category })` → server-generated path + signed upload details + evidence draft ID.
  - `finalizeUpload({ evidenceId, title, documentDate?, reviewDate?, notes? })` → ACTIVE evidence metadata + processing job.
  - `link({ evidenceId, requirementId })` → active evidence/requirement link.
  - `supersede({ evidenceId })` → evidence inactive for readiness + affected requirement IDs.
  - `download({ evidenceId })` → short-lived authorised signed read URL.
- Enforce initial max upload size: 10 MB.
- Allowed initial MIME types: PDF, DOCX, TXT, PNG, JPEG.

- [ ] **Step 1: Write failing function/server/UI tests**
  - Missing auth → 401.
  - Malicious `practiceId` request field is ignored.
  - Oversized/unsupported file rejected before signed upload is issued.
  - Storage path begins with authenticated `practiceId/cycleId/` and never uses raw filename as path identity.
  - Practice A cannot list/download Practice B evidence.
  - One evidence item can link to multiple requirements.
  - Supersede returns affected requirement IDs and removes it from active evidence lists.
  - UI renders evidence category/status/mapped requirements and an honest Not Reviewed state.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `node --test tests/accreditation-evidence-*.test.mjs`

Expected: FAIL because endpoint/service/UI do not exist.

- [ ] **Step 3: Implement server helpers and Netlify endpoint**
  - Add focused Supabase server methods for evidence metadata, links, jobs and signed Storage operations.
  - All practice IDs come from authenticated actor context.
  - Keep original file path immutable; version/supersession is metadata-driven.

- [ ] **Step 4: Implement browser service and Evidence view**
  - Browser requests upload preparation, uploads using signed details, then finalizes metadata.
  - Show processing/review status without pretending analysis succeeded.

- [ ] **Step 5: Add runtime route/config**

Add:
- Netlify redirect `/api/accreditation-evidence`.
- `MEDIQO_ACCREDITATION_EVIDENCE_API_URL=/api/accreditation-evidence`.

- [ ] **Step 6: Run full verification**

Run: `npm test && npm run build && npm run smoke`

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

`git add netlify/functions src netlify.toml scripts/runtime-config.mjs .env.example tests && git commit -m "feat: add secure accreditation evidence workflow"`

---

### Task 4: Evidence extraction/review and readiness re-check

**Files:**
- Create: `netlify/functions/_shared/accreditation-evidence-review.mjs`
- Create: `netlify/functions/accreditation-evidence-review.mjs`
- Modify: `netlify/functions/_shared/openai.mjs`
- Modify: `netlify/functions/_shared/accreditation-assessment.mjs`
- Modify: `netlify/functions/_shared/supabase-server.mjs`
- Modify: `netlify.toml`
- Test: `tests/accreditation-evidence-review.test.mjs`
- Test: `tests/accreditation-evidence-reassessment.test.mjs`

**Interfaces:**
- `extractEvidenceText({ bytes, mimeType, filename }) -> { text, supported, warnings }`.
- `reviewEvidence({ requirement, evidenceCriteria, extractedText, metadata, openai }) -> EvidenceAssessment`.
- EvidenceAssessment:
  `{ reviewStatus, reason, extractedFacts, missingElements, detectedDates, recommendedAction, requirementIds, model }`.
- Netlify route: `POST /api/accreditation-evidence-review` with `{ action: "review", evidenceId }`.
- `reassessRequirementWithEvidence({ requirement, response, evidenceAssessments, previousState })` produces the existing assessment output shape.

- [ ] **Step 1: Write failing review/reassessment tests**
  - Unsupported file → NOT_REVIEWED; readiness unchanged.
  - OpenAI timeout/error → MORE_INFORMATION_REQUIRED; readiness unchanged.
  - User Yes + current relevant reviewed evidence may become APPEARS_READY only when requirement rules support it.
  - Stale/incomplete evidence → NEEDS_ATTENTION.
  - User/evidence contradiction → NEEDS_ATTENTION + requiresReassessment.
  - Superseded/deleted evidence is excluded; a former APPEARS_READY state is re-evaluated without it.
  - AI output containing pass/fail/compliant/certified is rejected/normalised and never persisted as status reason.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/accreditation-evidence-review.test.mjs tests/accreditation-evidence-reassessment.test.mjs`

Expected: FAIL because review/reassessment modules do not exist.

- [ ] **Step 3: Implement extraction boundary**
  - TXT: decode directly.
  - PDF: use `pdf-parse`; DOCX: use `mammoth`; add both through npm so `package-lock.json` pins the resolved versions.
  - PNG/JPEG: keep NOT_REVIEWED in this batch unless a supported model input path is deliberately added; do not OCR with an unverified local path.

- [ ] **Step 4: Implement structured OpenAI evidence review**
  - Send only the target requirement, its evidence criteria and extracted evidence text.
  - Validate model output server-side.
  - Store model/review metadata.
  - Never let failed processing mutate readiness.

- [ ] **Step 5: Integrate deterministic re-assessment**
  - Assessment engine consumes active evidence assessment objects in addition to user response.
  - Re-check affected requirements after review/supersede.

- [ ] **Step 6: Run full verification**

Run: `npm test && npm run build && npm run smoke`

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

`git add netlify/functions tests netlify.toml package.json package-lock.json && git commit -m "feat: review accreditation evidence and recheck readiness"`

---

### Task 5: Approved knowledge retrieval and Ask Accreditation Assistant

**Files:**
- Create: `netlify/functions/_shared/openai-embeddings.mjs`
- Create: `netlify/functions/_shared/accreditation-retrieval.mjs`
- Create: `netlify/functions/accreditation-assistant.mjs`
- Create: `scripts/ingest-accreditation-knowledge.mjs`
- Modify: `netlify/functions/_shared/supabase-server.mjs`
- Create: `src/services/accreditation-assistant-service.js`
- Create: `src/components/accreditation/assistant.js`
- Modify: `src/components/accreditation.js`
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Modify: `netlify.toml`
- Modify: `scripts/runtime-config.mjs`
- Modify: `.env.example`
- Test: `tests/accreditation-retrieval.test.mjs`
- Test: `tests/accreditation-assistant-function.test.mjs`
- Test: `tests/accreditation-assistant-ui.test.mjs`

**Interfaces:**
- `embedText(text, { model }) -> number[]`.
- `retrieveAccreditationContext({ practiceId, cycleId, question, requirementId?, server, embed }) -> { requirementContext, knowledgeChunks, evidenceContext, citations }`.
- Browser route: `POST /api/accreditation-assistant`.
- Request: `{ question, conversationId?, cycleId, requirementId? }`.
- Response: `{ conversationId, answer: { intro, sections, citations, knownPracticeFacts, uncertainty, relatedQuestions } }`.
- Ingestion script converts controlled workbook requirements/source metadata into approved knowledge chunks and generates embeddings using `OPENAI_EMBEDDING_MODEL || text-embedding-3-large`.

- [ ] **Step 1: Write failing retrieval/assistant tests**
  - Retrieval ignores inactive/unreviewed knowledge sources.
  - Practice A cannot retrieve Practice B evidence chunks.
  - Requirement-scoped question retrieves its controlled requirement first.
  - Every returned citation ID maps to a retrieved source/evidence record.
  - Missing context returns explicit uncertainty rather than invented guidance.
  - AI output cannot introduce citation IDs absent from retrieval.
  - Assistant never emits pass/fail/compliant/certified claims.
  - Conversation/messages/citations persist under authenticated practice/cycle.
  - UI renders citations and separates known practice facts from general guidance.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `node --test tests/accreditation-retrieval.test.mjs tests/accreditation-assistant-function.test.mjs tests/accreditation-assistant-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement knowledge ingestion and vector retrieval**
  - Chunk only approved controlled workbook-derived content and explicitly approved sources.
  - Store source version/hash/review state.
  - Add deterministic fallback retrieval by requirement ID/indicator when embeddings are unavailable.

- [ ] **Step 4: Implement accreditation AI endpoint**
  - Authenticate.
  - Retrieve approved/private context.
  - Call OpenAI with strict accreditation instructions.
  - Normalise structured output.
  - Persist conversation/messages/citations.

- [ ] **Step 5: Implement accreditation chat UI**
  - Reuse the friendly thinking/scroll pattern from general Ask MediQo.
  - Keep accreditation conversation context separate from general Q&A.

- [ ] **Step 6: Add runtime route/config**

Add:
- `/api/accreditation-assistant`.
- `MEDIQO_ACCREDITATION_ASSISTANT_API_URL=/api/accreditation-assistant`.
- `OPENAI_EMBEDDING_MODEL=text-embedding-3-large` server-side only.

- [ ] **Step 7: Run full verification**

Run: `npm test && npm run build && npm run smoke`

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

`git add netlify/functions scripts src netlify.toml scripts/runtime-config.mjs .env.example tests && git commit -m "feat: add source-backed accreditation assistant"`

---

### Task 6: What's Missing, accreditation Actions and Team readiness

**Files:**
- Create: `netlify/functions/accreditation-work.mjs`
- Create: `netlify/functions/_shared/accreditation-gaps.mjs`
- Modify: `netlify/functions/_shared/supabase-server.mjs`
- Create: `src/services/accreditation-work-service.js`
- Create: `src/components/accreditation/missing.js`
- Create: `src/components/accreditation/actions.js`
- Create: `src/components/accreditation/team.js`
- Modify: `src/components/accreditation.js`
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Modify: `netlify.toml`
- Test: `tests/accreditation-gaps.test.mjs`
- Test: `tests/accreditation-work-function.test.mjs`
- Test: `tests/accreditation-work-ui.test.mjs`

**Interfaces:**
- `buildMissingItems({ requirements, evidence, actions, team }) -> MissingItem[]`.
- Browser route: `POST /api/accreditation-work`.
- Actions:
  - `missing({ cycleId })`
  - `listActions({ cycleId })`
  - `saveAction({ cycleId, action })`
  - `updateAction({ actionId, patch })`
  - `listTeam({ cycleId })`
  - `saveTeamMember({ cycleId, member })`
  - `saveCredential({ teamMemberId, credential })`
  - `saveTraining({ teamMemberId, training })`.

- [ ] **Step 1: Write failing gap/workflow tests**
  - Confirmed Gap appears in What's Missing.
  - Missing/stale evidence appears once with requirement context.
  - P1 Not Checked items appear as priority follow-up.
  - Suggested action can be accepted/assigned with owner/due date.
  - Completing an action does not alter readiness.
  - Team credential/training expiry appears as follow-up when linked to requirement/evidence criteria.
  - Practice A cannot access Practice B actions/team.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `node --test tests/accreditation-gaps.test.mjs tests/accreditation-work-function.test.mjs tests/accreditation-work-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement server gap aggregation and work endpoint**
  - Gap list is server-derived.
  - Action/team writes use authenticated practice ID.
  - No readiness mutation from task completion alone.

- [ ] **Step 4: Implement What's Missing, Actions and Team views**
  - Clear filters for priority/status/owner.
  - Requirement links open existing requirement detail.
  - Empty states explain what will populate the view.

- [ ] **Step 5: Run full verification**

Run: `npm test && npm run build && npm run smoke`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

`git add netlify/functions src netlify.toml tests && git commit -m "feat: add accreditation gaps actions and team workflows"`

---

### Task 7: AI pre-accreditation review and persisted Readiness Report

**Files:**
- Create: `netlify/functions/_shared/accreditation-report.mjs`
- Create: `netlify/functions/accreditation-review.mjs`
- Modify: `netlify/functions/_shared/supabase-server.mjs`
- Create: `src/services/accreditation-report-service.js`
- Create: `src/components/accreditation/report.js`
- Modify: `src/components/accreditation.js`
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Modify: `netlify.toml`
- Test: `tests/accreditation-report.test.mjs`
- Test: `tests/accreditation-review-function.test.mjs`
- Test: `tests/accreditation-report-ui.test.mjs`

**Interfaces:**
- `buildReadinessSnapshot({ cycle, requirements, evidence, actions, team }) -> Snapshot`.
- `buildMockAssessorQuestions(snapshot, controlledRequirements) -> Question[]`.
- Browser route: `POST /api/accreditation-review`.
- Actions:
  - `run({ cycleId })` → persisted review snapshot + report.
  - `latest({ cycleId })` → last complete snapshot/report.
  - `download({ reportId })` → report presentation object for browser download/print.
- Snapshot includes coverage, statusCounts, gaps, evidenceIssues, openActions, teamFollowUp, priorityNotChecked, preparationRecommendations, mockAssessorQuestions, generatedAt.

- [ ] **Step 1: Write failing report tests**
  - Four readiness counts equal server state.
  - Missing/stale evidence and open actions are included.
  - Completing an action alone does not change status counts.
  - Mock assessor questions are linked to controlled requirements and contain no invented requirement IDs.
  - Failed new generation leaves prior complete snapshot available.
  - Report includes limitations and never claims compliance/certification.
  - Practice A cannot fetch Practice B report.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `node --test tests/accreditation-report.test.mjs tests/accreditation-review-function.test.mjs tests/accreditation-report-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement snapshot/report server modules**
  - Snapshot is deterministic from persisted state.
  - Optional AI preparation narrative/mock questions are constrained to snapshot + controlled requirements.
  - Persist only after a complete successful generation.

- [ ] **Step 4: Implement Readiness Report UI/download**
  - Show historical generated timestamp and limitations.
  - Download as print-friendly HTML/text first; no dependency on global Reports page.

- [ ] **Step 5: Run full verification**

Run: `npm test && npm run build && npm run smoke`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

`git add netlify/functions src netlify.toml tests && git commit -m "feat: add accreditation readiness review and report"`

---

### Task 8: Connect accreditation document gaps to Policy Library and lock release blockers

**Files:**
- Modify: `src/components/policies.js`
- Modify: `src/app.js`
- Modify: `src/app.js` for the existing Policy Library document-generation/save/download flow.
- Modify: `src/components/accreditation/missing.js`
- Modify: `src/components/accreditation/requirement-detail.js`
- Create: `tests/accreditation-policy-handoff.test.mjs`
- Create: `tests/accreditation-completion-release-blockers.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Accreditation missing-document CTA passes:
  `{ documentType, requirementIds, considerations, practiceName }`
  into the existing/new Policy Library Create Document flow.
- Generated document remains editable/savable/downloadable and does not modify readiness until linked/reviewed as evidence.

- [ ] **Step 1: Write failing policy-handoff/release-blocker tests**
  - Missing policy CTA opens Policy Library Create Document with linked requirement IDs.
  - Generated/saved policy does not automatically set APPEARS_READY.
  - HOLD remains inactive.
  - VALIDATE remains unverified.
  - No cross-practice evidence/action/team/AI/report access.
  - Superseded evidence cannot support readiness.
  - Assistant/report citations cannot reference unretrieved source IDs.
  - Global Reports nav remains hidden.
  - No current-regulatory claim is emitted without reviewed/fresh source metadata.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `node --test tests/accreditation-policy-handoff.test.mjs tests/accreditation-completion-release-blockers.test.mjs`

Expected: FAIL for missing handoff/guards.

- [ ] **Step 3: Implement Policy Library handoff and final guards**
  - Reuse one document-generation service; do not duplicate policy generation inside accreditation.
  - Preserve requirement links as document metadata.
  - Require evidence linking/review before accreditation status can change.

- [ ] **Step 4: Update README**
  - New API routes/env variables.
  - Migration 004.
  - Storage bucket.
  - Knowledge ingestion command.
  - Local acceptance flow.
  - Explicit VALIDATE/HOLD/current-source limitations.

- [ ] **Step 5: Run final automated verification**

Run: `npm test && npm run build && npm run smoke`

Expected: 0 test failures, successful build, successful smoke.

- [ ] **Step 6: Commit**

`git add src netlify/functions tests README.md && git commit -m "feat: complete accreditation assistant workflows"`

- [ ] **Step 7: User-side migration and knowledge ingestion after pulling main**

Run:

```bash
npx supabase db push
node scripts/ingest-accreditation-knowledge.mjs
npm run build
npx netlify dev --port 8888
```

Expected: migration 004 applies; controlled accreditation knowledge chunks are ingested; local functions load.

- [ ] **Step 8: Browser acceptance check**
  1. Existing 20/20 Quick Check persists.
  2. Upload one test policy/evidence file.
  3. Link it to a requirement and run review.
  4. Confirm Evidence and What's Missing update.
  5. Create one action with owner/due date and mark it done; readiness does not auto-upgrade.
  6. Add one team training/credential record.
  7. Ask “What evidence do we still need for this requirement?” in Ask Accreditation Assistant and inspect citations.
  8. Run pre-accreditation review.
  9. Open/download Readiness Report.
  10. Refresh/sign out/sign in; state persists.
  11. Confirm no pass/fail/compliant/certified claims.
