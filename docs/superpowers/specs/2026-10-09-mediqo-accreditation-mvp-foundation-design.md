# MediQo Accreditation MVP Foundation — Design

Date: 2026-10-09

## Purpose

Build the first real, source-backed Accreditation Assistant foundation from Elly's October 2026 accreditation brief and the supplied MVP Readiness Question Dataset. The goal is not to recreate the whole 260-page product in one batch. The goal is to replace the current illustrative accreditation demo with a production-shaped MVP that visibly uses the client brief and spreadsheet and can be safely extended into evidence review, actions, team readiness, policy generation and reports.

This batch should be strong enough for a client demonstration while preserving the product's central safety rule: **Known is not the same as Assumed.**

## Source hierarchy

1. **MediQo Accreditation Assistant — Build Brief.pdf** defines product behaviour, status language, safety rules, navigation, assessment boundaries and evidence semantics.
2. **MediQo_Accreditation_MVP_Readiness_Question_Dataset.xlsx** supplies the developer dataset for requirements, questions, answer options, branching prompts, evidence patterns and source metadata.
3. **MediQo Project Source of Truth — 7 Oct 2026** remains the wider product/backend handoff and tenancy/security reference.

Do not invent accreditation logic outside those sources. If the controlled dataset cannot support a conclusion, return **Not Checked / More information required**.

## Dataset facts used by this design

The supplied workbook contains seven sheets: README, Requirements, Questions, Answer Options, Branching Logic, Evidence Criteria and Sources.

The Requirements sheet contains 125 data rows:
- 55 rows classified as Mandatory and verified from current RACGP material.
- 6 rows classified as Aspirational and verified.
- 64 rows marked VALIDATE — do not assume mandatory/aspirational.
- 20 P1, 30 P2 and 75 P3 quick-check priorities.
- 20 rows marked as critical safety areas.
- 124 rows are developer-ready for UX/schema while still requiring accreditation-content validation before production.
- RACGP5-QI2-1C is HOLD and must not be treated as an active production requirement until validated.

The workbook's critical developer rule is binding: ask the smallest factual question still needed, do not ask the Practice Manager to decide compliance, do not ask what MediQo already knows, and do not invent assessment logic.

## Standards versioning

The formal current workspace is **RACGP Standards for general practices — 5th edition**.

The data model must support more than one standards version, but the future 6th-edition workspace must remain separate. Future-readiness requirements must never be mixed into the current formal 5th-edition assessment.

## Product language and status model

Readiness status is one of:

- `APPEARS_READY` — sufficient reviewed information/evidence and no obvious unresolved gap.
- `NEEDS_ATTENTION` — information/evidence exists but appears incomplete, stale, inconsistent or needs review.
- `CONFIRMED_GAP` — reliable information establishes that an applicable required element is not in place.
- `NOT_CHECKED` — insufficient information exists to assess.

Verification is stored separately:

- `USER_REPORTED`
- `EVIDENCE_UPLOADED`
- `AI_REVIEWED`
- `MANUALLY_VERIFIED`

Never use pass/fail/compliant/certified language. Never claim that a document or practice will pass accreditation.

## MVP user experience

### 1. Overview

The Accreditation Assistant landing page becomes a real workspace, not a hard-coded readiness score.

Show:
- practice name;
- active accreditation cycle;
- RACGP 5th edition badge;
- assessment target date when known;
- assessment coverage;
- readiness of assessed requirements only;
- counts for Appears Ready, Needs Attention, Confirmed Gap and Not Checked;
- next recommended action from server assessment output;
- entry points to Readiness Check and Requirements.

If the practice has not supplied enough information, show setup/empty states rather than fake percentages.

### 2. Readiness Check

The first useful flow is a Quick Check driven by P1 questions.

Rules:
- Ask only active P1 questions that are applicable or whose applicability still needs to be established.
- Suppress questions already reliably answered by structured practice data or confirmed evidence.
- Allow “I'm not sure” / unknown and preserve it as Not Checked.
- Save every answer with actor, practice, cycle, question, answer, timestamp and verification state.
- Resume where the Practice Manager left off.
- Show **coverage** independently from readiness.
- A positive user answer does not automatically create Appears Ready. It is initially user-reported and may remain Needs Attention until adequate evidence/verification exists.
- A partial answer can create Needs Attention where the dataset meaning supports that conclusion.
- A clear negative answer to an applicable, verified required element can create Confirmed Gap with `USER_REPORTED` verification.
- When a dataset row is VALIDATE or HOLD, do not invent the classification. HOLD is excluded from the active check. VALIDATE rows may be collected but must not be counted as verified mandatory/aspirational readiness.

### 3. Requirements

Replace the current ten-row demo list with dataset-backed requirement records.

The MVP table should show:
- indicator / requirement;
- criterion area;
- requirement classification, including an explicit “Validation required” label for VALIDATE rows;
- readiness status;
- verification status;
- evidence count;
- quick-check priority;
- critical-safety flag where applicable;
- last assessed / re-check required.

Filters:
- All;
- Appears Ready;
- Needs Attention;
- Confirmed Gap;
- Not Checked;
- P1 priority;
- Critical safety.

HOLD records are not shown as active requirements.

### 4. Requirement detail

A requirement detail view must be renderable from one server/domain object.

Show:
- indicator and plain-English requirement;
- RACGP source link;
- readiness and verification state;
- status reason;
- known facts;
- unknown facts;
- potential/confirmed gaps;
- primary readiness question;
- answer choices;
- contextual follow-up questions;
- possible evidence from the dataset;
- current practice response;
- recommended next action;
- history stub for future expansion.

The frontend displays this assessment; it does not compute the status.

## Critical architecture rule

**The frontend does not calculate accreditation readiness. It renders assessment-engine output.**

Do not add UI logic such as:

`if answer === 'Yes' then status = Ready`

All readiness decisions live in an assessment service/RPC. The browser may calculate presentation-only values such as whether a filter is selected, but not accreditation conclusions.

## Supabase data model

### Controlled configuration

`accreditation_standard_versions`
- id
- code
- name
- edition
- effective_from / effective_to
- workspace_type: CURRENT | FUTURE_READINESS
- is_active

`accreditation_requirements`
- id / requirement_id from workbook
- standard_version_id
- indicator
- criterion
- criterion_description
- classification: MANDATORY | ASPIRATIONAL | UNVERIFIED
- plain_english_requirement
- applicability_rule
- quick_check_priority
- critical_safety_area
- national_not_met_count / rank
- content_validation_status
- source URLs
- is_active
- source_payload jsonb for traceability

`accreditation_questions`
- question_id
- requirement_id
- purpose
- wording
- show_rule
- contextualisation_rule
- evidence_prompt
- clarification_template
- why_we_ask
- asked_because
- priority
- validation_status

`accreditation_answer_options`
- question_id
- option_order
- label
- option_type
- default_branch_behaviour

`accreditation_branching_rules`
- question_id
- branch_order
- trigger
- follow_up_wording
- suppression_rule

`accreditation_evidence_criteria`
- requirement_id
- evidence_type
- role
- evidence_rule
- assessment_dimensions

`accreditation_sources`
- source_id
- publisher
- title
- current_use
- url
- used_for
- verification

These tables are global controlled knowledge. Browser writes are not permitted.

### Practice-scoped state

`accreditation_cycles`
- practice_id
- standard_version_id
- target_assessment_date
- status
- started_at / completed_at

`practice_requirements`
- cycle_id
- requirement_id
- applicability_status
- readiness_status
- verification_status
- confidence
- status_reason
- known_facts jsonb
- unknown_facts jsonb
- potential_gaps jsonb
- confirmed_gaps jsonb
- recommended_actions jsonb
- last_assessed_at
- requires_reassessment

`readiness_responses`
- cycle_id
- requirement_id
- question_id
- user_id
- answer_label
- answer_detail jsonb
- verification_status
- answered_at
- superseded_at

Future evidence tables from the brief can attach to this model without changing the front-end assessment contract.

## Assessment service v1

The first assessment service is conservative and deterministic. It must never “fill in” missing logic with model intuition.

Inputs:
- requirement configuration;
- current practice requirement state;
- relevant readiness responses;
- known structured practice facts;
- evidence assessments when available later.

Outputs:
- applicability status;
- readiness status;
- verification status;
- confidence;
- status reason;
- known/unknown facts;
- gaps;
- recommended actions;
- `requires_reassessment`.

Initial response rules:
- Unknown / “I'm not sure” → NOT_CHECKED.
- Positive user report → do not automatically mark Appears Ready; record `USER_REPORTED` and require evidence/verification where the configured assessment basis needs it.
- Partial/incomplete response → NEEDS_ATTENTION when directly supported by the configured question meaning.
- Explicit negative response to an applicable verified required element → CONFIRMED_GAP, `USER_REPORTED`.
- HOLD → no active assessment.
- Missing or ambiguous configuration → NOT_CHECKED / More information required.

The service must be unit-tested separately from the UI.

## Coverage vs readiness

Coverage and readiness are different metrics.

**Coverage** = how much applicable information has actually been reviewed/answered.

**Readiness of assessed requirements** = status distribution for requirements that have enough information to assess.

The UI must not improve readiness merely because more questions were answered.

UNVERIFIED classification rows must not be counted in a “mandatory readiness” percentage.

## Import strategy

The Excel workbook is treated as a controlled build asset.

Create a deterministic import/generation script that:
1. reads the seven sheets;
2. validates required columns, IDs and referential integrity;
3. converts pipe-delimited answer/follow-up fields into normalized records;
4. converts workbook classification text into controlled enum values without guessing;
5. marks RACGP5-QI2-1C inactive/HOLD;
6. emits version-controlled SQL/JSON seed data;
7. fails the build/import when duplicate IDs, broken foreign keys or unsupported classifications are found.

Do not hand-copy 125 rows into JavaScript.

## RLS and permissions

Controlled accreditation configuration is readable by authenticated users but not browser-writable.

Practice/cycle/response/assessment rows are tenant-scoped using existing practice membership helpers.

Service-role writes are limited to trusted Netlify Functions/import jobs.

A user from Practice A must not be able to read or mutate Practice B accreditation cycles, responses or requirement assessments.

## OpenAI role

OpenAI can later:
- contextualise question wording without changing meaning;
- explain an assessment;
- summarise retrieved approved sources;
- assess evidence using defined rubrics;
- generate practice documents.

OpenAI must not be the source of requirement existence, mandatory/aspirational classification, applicability or readiness logic when the controlled dataset does not support the conclusion.

## Client-showable acceptance criteria for this batch

A signed-in Practice Manager can:
1. open Accreditation Assistant and see RACGP 5th edition as the active current workspace;
2. start/resume a real accreditation cycle;
3. answer P1 Quick Check questions loaded from Elly's spreadsheet;
4. use “I'm not sure” without being marked as failing;
5. see coverage increase independently of readiness;
6. open Requirements and see real dataset-backed rows, including validation labels;
7. open a requirement detail and see its question/evidence/source configuration;
8. see only the four approved readiness statuses;
9. see that user-reported completeness is not represented as certified/Ready without sufficient support;
10. refresh/sign back in and retain responses.

## Explicit non-goals for this first accreditation batch

These remain in the client brief but are separate implementation slices:
- evidence file upload/storage and document extraction;
- AI evidence sufficiency review;
- team credentials/training module;
- action/task assignment;
- document/policy generation;
- full What’s Missing workflow;
- final Readiness Report;
- 6th-edition future-readiness workspace UI;
- live regulatory freshness monitoring.

The data model must leave room for all of them.

## Release blockers

Do not ship accreditation if testing repeatedly shows:
- invented requirements or citations;
- incorrect mandatory/aspirational classification;
- false Appears Ready outcomes;
- incorrect N/A classification;
- failure to recognise conflicting information;
- deleted evidence still supporting readiness;
- stale requirement versions being used.

These are higher severity than cosmetic UI issues.
