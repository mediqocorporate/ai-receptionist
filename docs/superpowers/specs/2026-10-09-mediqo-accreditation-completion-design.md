# MediQo Accreditation Completion — Design

Date: 2026-10-09

## Purpose

Complete the remaining Accreditation Assistant work defined by Elly's accreditation brief while preserving the source-backed RACGP 5th Edition foundation already implemented.

The finished product should help a Practice Manager move from readiness questions to evidence review, gaps, actions, team preparation, accreditation Q&A and a practical readiness report without asking the Practice Manager to decide whether the practice is compliant.

## Source of truth

This design follows Elly's accreditation requirements and the controlled accreditation workbook already imported into MediQo.

Client-required Phase 2 capability includes:
- upload and organise evidence against standards;
- review whether evidence is sufficient, incomplete, outdated or missing;
- identify and prioritise gaps;
- identify missing/outdated policies;
- generate/update documents using practice-specific information;
- compare policies with current requirements;
- explain regulatory changes only when supported by approved/current sources;
- run an AI pre-accreditation review;
- generate mock assessor questions and role-specific preparation.

The existing controlled RACGP 5th Edition requirement/question dataset remains authoritative for requirement existence, classifications, readiness questions, evidence patterns and source references.

## Product boundary

This project completes the current RACGP 5th Edition Accreditation Assistant. It does not merge future 6th Edition readiness into the current formal workspace.

The global Reports menu remains hidden per client request. Accreditation gets its own Readiness Report inside the Accreditation Assistant.

## Navigation

The Accreditation Assistant workspace will use these internal views:

1. Overview
2. Readiness Check
3. Requirements
4. Evidence
5. What's Missing
6. Actions
7. Team
8. Ask Accreditation Assistant
9. Readiness Report

Future 6th Edition remains a separate later workspace.

## Core safety rules

These rules remain non-negotiable:

- Known is not the same as Assumed.
- Unknown information remains Not Checked / More information required.
- Allowed readiness states are:
  - Appears Ready
  - Needs Attention
  - Confirmed Gap
  - Not Checked
- Verification state is separate from readiness:
  - User Reported
  - Evidence Uploaded
  - AI Reviewed
  - Manually Verified
- MediQo never says pass, fail, compliant, certified or guaranteed accreditation outcome.
- The browser never computes accreditation readiness.
- The server assessment layer owns readiness decisions.
- VALIDATE rows remain unverified.
- HOLD rows remain inactive.
- Deleting or superseding evidence must immediately remove it from active readiness support.
- No source/citation may be invented.
- Patient-identifiable information is not intentionally collected in this accreditation MVP until the client confirms privacy/data-residency requirements.

## Evidence

### Evidence upload

Authenticated practice users can upload accreditation evidence to Supabase Storage through a trusted server flow.

Supported MVP categories include:
- policy/procedure;
- register;
- training/credential record;
- certificate;
- audit/report;
- meeting record;
- equipment/maintenance record;
- patient feedback evidence;
- other practice evidence.

Each upload stores:
- practice ID;
- accreditation cycle ID;
- uploader;
- original filename;
- MIME type;
- storage path;
- evidence category;
- title/description;
- document date if supplied;
- review/expiry date if supplied;
- uploaded timestamp;
- status: active, superseded, archived;
- version number;
- source hash/fingerprint;
- optional notes.

Uploads are tenant-scoped and private.

### Evidence ↔ requirement mapping

Evidence can support multiple requirements and each requirement can have multiple evidence items.

The mapping stores:
- evidence ID;
- requirement ID;
- relationship type;
- mapped by: user / AI suggestion / manually verified;
- mapping confidence;
- mapping reason;
- active/inactive state.

AI may suggest mappings but must not silently mark them manually verified.

### Evidence assessment

For a mapped evidence item, MediQo can assess:
- relevance;
- completeness;
- currency;
- internal consistency;
- whether expected evidence elements appear to be present;
- whether more information is required.

Evidence assessment outputs:
- SUFFICIENT_FOR_REVIEW
- INCOMPLETE
- OUTDATED
- CONFLICTING
- NOT_REVIEWED
- MORE_INFORMATION_REQUIRED

These are evidence-review states, not accreditation pass/fail states.

The AI assessment must include:
- concise reason;
- extracted facts used;
- missing elements;
- dates detected;
- recommended next action;
- source requirement IDs;
- model/version metadata.

## Evidence processing

### Upload flow

1. Browser requests a signed/private upload operation from a Netlify Function.
2. Server validates the authenticated user and practice membership.
3. File is stored under a practice/cycle scoped path.
4. Evidence metadata is inserted.
5. Evidence processing job is created.
6. Server extracts text where supported.
7. AI reviews extracted text against only the explicitly linked or candidate requirements.
8. Suggested requirement mappings and evidence assessments are stored.
9. The deterministic readiness engine re-checks affected requirements.
10. UI refreshes Evidence, What's Missing, Overview and Requirement Detail.

### MVP file handling

Initial processing targets text-readable office/PDF formats supported by the available extraction path. Unsupported files remain uploaded and visible but show Not Reviewed instead of fabricated analysis.

The system must preserve the original file even when extracted text exists.

## Readiness engine integration

Evidence does not automatically make a requirement Appears Ready.

The server assessment combines:
- controlled requirement configuration;
- applicability;
- user responses;
- reviewed evidence assessments;
- manual verification state;
- contradictions/stale evidence.

Conservative rules:
- user Yes + no reviewed evidence → usually Needs Attention;
- user No to an applicable verified requirement → Confirmed Gap;
- unknown → Not Checked;
- relevant current evidence with no unresolved gap may support Appears Ready;
- stale/incomplete/conflicting evidence → Needs Attention;
- deleted/superseded evidence cannot support Appears Ready;
- conflicting user report and evidence forces Needs Attention / requires re-check;
- ambiguous logic → Not Checked / More information required.

## What's Missing

The What's Missing view is server-generated from the current cycle.

Sections:
- Confirmed gaps;
- Needs evidence;
- Evidence incomplete/outdated;
- Missing policies/documents;
- Training/credential follow-up;
- Not Checked priority requirements;
- Re-check required.

Each row includes:
- requirement;
- why it appears here;
- priority;
- evidence expected;
- next action;
- owner if assigned;
- due date if assigned;
- open requirement/evidence/action controls.

The browser does not derive this list from badge colors; the server returns the gap objects.

## Actions

### Action model

Accreditation actions are tenant-scoped tasks linked to a cycle and optionally to:
- requirement;
- evidence item;
- team member.

Fields:
- title;
- description;
- action type;
- priority;
- owner user/team member;
- due date;
- status: OPEN, IN_PROGRESS, BLOCKED, DONE;
- source/reason;
- created by;
- timestamps;
- completion note.

### Automatic suggestions

The server may suggest actions from:
- Confirmed Gap;
- Needs Attention;
- missing evidence;
- stale evidence;
- credential/training expiry;
- policy/document gap.

Suggested actions require user confirmation before becoming assigned work unless they are system-generated unassigned recommendations.

Completing an action does not itself change readiness; a re-check is required.

## Team

The Team view supports accreditation preparation, not general HR management.

Team Member fields:
- name;
- role;
- employment/engagement type where supplied;
- active status.

Credential/Training fields:
- type;
- issuer;
- identifier if supplied;
- issue date;
- expiry/review date;
- evidence link;
- status;
- notes.

This supports role-specific accreditation preparation, credential tracking and evidence mapping.

The MVP avoids collecting unnecessary sensitive information.

## Ask Accreditation Assistant

### Purpose

The existing "Ask Accreditation Assistant" control becomes a dedicated authenticated accreditation conversation.

It answers questions about:
- the practice's current readiness;
- a specific requirement;
- evidence needed;
- why a status exists;
- what to do next;
- accreditation preparation;
- mock assessor questions;
- role-specific preparation.

### Retrieval

The server retrieves:
1. controlled requirement/question/evidence configuration;
2. current practice/cycle assessment state;
3. relevant approved accreditation sources;
4. relevant practice evidence that the user is authorised to access.

Retrieval is practice scoped for private evidence and global only for approved shared sources.

### AI rules

The model must:
- answer from retrieved context;
- separate known practice facts from general guidance;
- cite the relevant requirement/source;
- say when information is not available;
- never invent a requirement, source or evidence fact;
- never claim certification/compliance;
- avoid patient-identifiable data;
- recommend re-check/upload/action where appropriate.

The accreditation assistant conversation is stored separately from the general Ask MediQo thread, with practice/cycle/requirement context and citations.

## RAG / approved sources

### Knowledge model

Add approved knowledge-source and chunk tables with:
- source ID;
- publisher;
- canonical title;
- canonical URL/file origin;
- version/effective date;
- reviewed/active state;
- content hash;
- permissions/scope;
- chunk text;
- embedding;
- metadata.

Only active/reviewed sources are eligible for production retrieval.

### Embeddings

Use the configured OpenAI embedding model from a trusted server/ingestion path.

The client brief's controlled source URLs and workbook source metadata seed the initial accreditation source catalogue.

Do not represent regulatory material as "current" unless a freshness/review process exists.

### Citations

Every source-backed accreditation AI answer returns structured citations:
- source ID;
- title;
- publisher;
- URL where available;
- requirement ID/indicator when relevant;
- retrieved chunk IDs.

The frontend renders citations from server data only.

## Policy/document connection

Accreditation can identify that a policy/document may be missing or needs review.

The Accreditation Assistant may launch the Policy Library "Create Document" flow with:
- document type;
- linked accreditation requirement(s);
- practice context;
- requested considerations.

Generated documents:
- are editable;
- are saved/versioned;
- can be downloaded;
- can later be uploaded/linked as evidence;
- do not automatically become accreditation-ready or Appears Ready.

Policy generation is owned by the Policy Library service, not duplicated inside accreditation.

## AI pre-accreditation review

A user can run a pre-accreditation review after enough of the cycle has been checked.

Server produces a snapshot containing:
- coverage;
- readiness distribution;
- confirmed gaps;
- needs-attention items;
- missing/stale evidence;
- overdue actions;
- team/training concerns;
- high-priority Not Checked requirements;
- recommended preparation sequence;
- mock assessor questions.

The review is a preparation aid, not a prediction of accreditation outcome.

## Readiness Report

The Readiness Report is generated from a saved assessment snapshot.

Report sections:
- practice/cycle summary;
- RACGP 5th Edition identification;
- assessment coverage;
- four readiness status counts;
- priority gaps;
- evidence status;
- actions outstanding;
- team/training follow-up;
- Not Checked priority items;
- preparation recommendations;
- sources/limitations.

The report can be downloaded. Initial download may be print-friendly HTML/PDF-ready output, but report data itself must be persisted so refresh/account changes do not alter historical snapshots.

## UI polish

Before client demonstration:
- replace internal/developer-ish accreditation wording with clear Practice Manager language while preserving meaning;
- completed Quick Check shows Review Quick Check, not Continue;
- hide the global Reports menu;
- keep accreditation status language consistent;
- show clear loading/error/empty states;
- preserve the existing MediQo visual language rather than redesigning the app.

## Database additions

Add version-controlled migrations for these entities:

- accreditation_evidence
- accreditation_evidence_versions if needed for explicit version history
- accreditation_evidence_requirement_links
- accreditation_evidence_assessments
- accreditation_processing_jobs
- accreditation_actions
- accreditation_team_members
- accreditation_credentials
- accreditation_training_records
- accreditation_ai_conversations
- accreditation_ai_messages
- accreditation_ai_sources/citations
- accreditation_review_snapshots
- accreditation_readiness_reports
- knowledge_sources
- knowledge_chunks

Existing tables remain:
- accreditation_standard_versions
- accreditation_requirements
- accreditation_questions
- accreditation_answer_options
- accreditation_branching_rules
- accreditation_evidence_criteria
- accreditation_cycles
- practice_requirements
- readiness_responses

## Security and RLS

- Private evidence/storage paths are scoped to practice ID and cycle.
- Browser users cannot write readiness assessment rows directly.
- Service-role writes occur only from trusted Netlify Functions/ingestion jobs.
- Practice A cannot read Practice B files, evidence, actions, team records, conversations or reports.
- Global approved knowledge is read-only from the browser.
- Upload filenames/metadata are sanitised; storage paths are server-generated.
- File size/type limits are enforced server-side.
- AI processing never grants additional access to private evidence.

## Netlify Functions / service boundaries

Use focused endpoints rather than one giant accreditation handler:

- accreditation.mjs — existing overview/readiness/requirement operations;
- accreditation-evidence.mjs — evidence metadata/upload/link/review operations;
- accreditation-actions.mjs — actions/team workflow operations where appropriate;
- accreditation-assistant.mjs — accreditation-specific AI Q&A;
- accreditation-review.mjs — pre-accreditation snapshot/report generation;
- knowledge-ingest.mjs — trusted approved-source ingestion, not browser-public.

Shared modules:
- accreditation-assessment.mjs
- accreditation-retrieval.mjs
- accreditation-evidence-review.mjs
- accreditation-report.mjs
- supabase-server.mjs
- openai.mjs

Each shared module has one clear responsibility and independent tests.

## Error handling

- Failed extraction/AI review does not delete uploaded evidence.
- Failed AI review leaves evidence as Not Reviewed and provides retry.
- Missing/unsupported source context returns More information required.
- OpenAI timeout does not mutate readiness.
- Storage/database partial failures return a stable error and avoid orphaned active mappings where possible.
- Report generation uses the last complete snapshot if a new run fails.
- Evidence re-check jobs are idempotent.

## Testing

### Database/RLS
- tenant isolation for every new practice-scoped table;
- browser cannot bypass assessment engine;
- storage access isolation;
- deleting/superseding evidence removes active support.

### Evidence
- upload validation;
- mapping many-to-many;
- unsupported files stay Not Reviewed;
- stale/expired evidence;
- evidence contradiction handling;
- re-assessment after evidence change.

### AI/RAG
- only approved active sources retrieved;
- private evidence filtered by practice;
- citation IDs correspond to retrieved sources;
- no invented citation objects;
- missing context produces uncertainty;
- prohibited pass/fail/compliance language rejected/normalised.

### Actions/team
- correct practice scoping;
- due dates/status persistence;
- completing a task does not automatically improve readiness.

### Reports
- snapshot persistence;
- correct four-status totals;
- gap/evidence/action data is server derived;
- report wording contains limitations.

### Existing regressions
Keep auth, Q&A quota, chat history, HubSpot embeds, PMS UI and current accreditation Quick Check tests green.

## Implementation order

1. UI/client polish + hide global Reports.
2. Evidence schema/storage/mapping UI.
3. Evidence extraction/review + assessment re-check.
4. Accreditation RAG and Ask Accreditation Assistant.
5. What's Missing + Actions.
6. Team credentials/training.
7. Pre-accreditation review + Readiness Report.
8. Policy Library connection for missing documents.
9. Final security/tenant/citation regression pass.
10. Local manual acceptance before Netlify deployment.

## Client-showable acceptance criteria

A signed-in Practice Manager can:

1. complete the current Quick Readiness Check and retain progress;
2. upload practice evidence securely;
3. map evidence to requirements and see AI review state;
4. see gaps/evidence issues in What's Missing;
5. create/assign/complete accreditation actions;
6. track accreditation-relevant team credentials/training;
7. ask the Accreditation Assistant a requirement/evidence question and receive a source-backed answer;
8. open requirement detail and see practice facts, evidence, citations, actions and status reason;
9. run a pre-accreditation review;
10. download/view a readiness report;
11. refresh/sign back in and retain practice state;
12. never see invented pass/fail/certification claims.

## Release blockers

Do not deploy this completion batch if testing repeatedly shows:
- invented requirements/citations;
- cross-practice evidence leakage;
- false Appears Ready from user answer alone;
- deleted/superseded evidence still supporting readiness;
- wrong VALIDATE/HOLD handling;
- AI review mutating readiness after failed/partial processing;
- private evidence retrieved for the wrong tenant;
- report claiming compliance/certification;
- current regulatory claims without source freshness support.
