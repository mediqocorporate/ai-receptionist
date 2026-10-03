# MediQo AI Practice Manager Assistant — Prototype Design Specification

Date: 2026-10-04
Status: Ready for implementation review

## 1. Product intent

Build a polished, runnable MediQo prototype for Australian general-practice managers that feels like a genuine MediQo product rather than a generic chatbot.

The prototype must let a reviewer run the project locally in VS Code, explore the key product areas, ask seeded demo questions and receive believable structured answers, experience the two-free-question signup gate, and navigate the future product modules without requiring live AI, HubSpot, PMS, RAG, or authentication services.

Primary success criteria:

- Looks recognisably MediQo and matches the supplied screenshots closely.
- Runs locally with a simple `npm install` and `npm run dev` flow.
- Includes realistic demo interactions instead of dead placeholder screens.
- Preserves clean seams for later production integrations.
- Is responsive and keyboard-accessible.
- Avoids making prototype/demo regulatory content look like verified live guidance.

## 2. Source of truth and design hierarchy

Priority order:

1. Elley's “New AI Tool - MediQo” email and direct follow-up instructions.
2. Supplied MediQo UI screenshots.
3. Existing MediQo Partner Platform visual language.
4. Uploaded Interface Lexicon interaction and component guidance.
5. Reasonable usability improvements that do not contradict the above.

The public Partner Platform logo asset is referenced from:

`https://partners.mediqo.health/wp-content/uploads/2025/11/Vector-1.png`

If that remote asset fails during local development, the app should gracefully fall back to a text-based MediQo wordmark rather than breaking the layout.

## 3. Technical architecture

### 3.1 Frontend stack

- React
- TypeScript
- Vite
- React Router
- CSS variables + component CSS for brand fidelity
- Lucide React for interface icons
- No heavyweight UI framework

Reasoning: this keeps the prototype easy to run, easy to migrate, easy to hand to another developer, and avoids visual drift from generic component libraries.

### 3.2 App structure

The frontend is split into clear modules:

- `app/` — shell, routing, layout
- `components/` — reusable UI primitives and product components
- `pages/` — screen-level product areas
- `data/` — demo Q&A, alerts, policy templates, accreditation items, product copy
- `services/` — mockable interfaces for future AI, auth, HubSpot, PMS and RAG integrations
- `hooks/` — local persistence and demo state
- `styles/` — MediQo design tokens and responsive rules

### 3.3 Production integration seams

The prototype must expose interfaces for later replacement:

- `assistantService.ask(question, context)`
- `authService.createAccount(payload)`
- `leadService.submit(payload)`
- `pmsService.connect()`
- `alertsService.list()`
- `knowledgeService.getSources()`

In the prototype these return local mock data. Production integrations can replace the implementation without rewriting pages.

## 4. MediQo visual system

### 4.1 Typography

Primary UI font: Inter.

Suggested stack:

`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

Weights:

- 400 body
- 500 controls / labels
- 600 emphasis / card titles
- 650–700 page headings

Typography should feel calm, medical, modern and practical rather than oversized or marketing-heavy.

### 4.2 Core colour tokens

Base the palette on the supplied MediQo materials and Interface Lexicon:

- `--bg: #F6F7F9`
- `--surface: #FFFFFF`
- `--surface-soft: #FAFAFA`
- `--ink: #1A1D1F`
- `--body: #454C52`
- `--muted: #676E76`
- `--line: #E5E7EA`
- `--line-strong: #CED2D6`
- `--purple: #7731D8`
- `--purple-soft: #F2EBFC`
- `--purple-dark: #5421B8`
- `--green: #15803D`
- `--green-soft: #E8F6EC`
- `--orange: #B45309`
- `--orange-soft: #FDF3E2`
- `--red: #DC2626`
- `--red-soft: #FDECEC`

Primary CTA may use the MediQo purple-to-magenta gradient visible in the supplied screenshots, but most interface actions should use solid purple for consistency and accessibility.

### 4.3 Shape and depth

- Main cards: 10–12 px radius
- Controls: 8–10 px radius
- Pills: fully rounded only for compact tags/status
- Shadows: very restrained
- Borders: visible neutral 1 px lines
- Large white surfaces should remain visually quiet

### 4.4 Interaction system

Follow the Interface Lexicon's MediQo skin:

- clear `:focus-visible` treatment
- purple focus ring
- hover states that do not depend on motion
- tooltips available by hover and focus
- modal focus trapping
- Escape closes dialogs
- disabled states clearly visible
- minimum practical hit areas for icon buttons
- reduced-motion friendly transitions
- toast feedback for save/copy/demo actions

## 5. Global application shell

### 5.1 Left navigation

Desktop left sidebar:

Primary group:

- Ask a Question
- Accreditation Assistant
- Policy Library
- Reports

Product group:

- AI Receptionist
- Scribe
- Document Sorter
- Care Plan Generation
- MBS Billing Suggestions
- Telehealth
- Online Bookings

Footer identity card:

- Practice Manager
- Riverside Medical Centre

Top practice selector:

- Riverside Medical Centre

Mobile behaviour:

- collapsible drawer
- same information architecture
- active item retained

### 5.2 Top bar

Right side:

- `Connect your PMS` action, replacing “BP synced” for now
- Alerts bell with unread indicator
- Help
- avatar / user menu

`Connect your PMS` opens a prototype modal explaining that PMS connection is coming soon.

## 6. Ask a Question experience

### 6.1 Empty/home state

Use the supplied “Your AI Assistant for Practice Management” structure:

Hero:

- sparkle icon
- heading
- short supporting copy

Six suggestion cards:

- Prepare for accreditation
- Check a requirement
- Handle a situation
- Create something
- Medicare and billing
- See what other practices do

Bottom composer:

- text input
- attachment icon
- character counter
- send button
- Enter submits; Shift+Enter adds a line

### 6.2 Conversation layout

Desktop:

- main conversation column
- right sidebar for related questions + related resources

Chat rules:

- User message/avatar on the right.
- Assistant response is wider/full-content and visually quieter.
- Responses have clear section structure.
- Sources appear in a dedicated source block.
- Footer controls: helpful thumbs, save.

Response format where relevant:

1. Direct practical answer
2. What this means for your practice
3. Recommended actions
4. Sources

### 6.3 Demo content badge

Because the prototype does not use the live controlled knowledge base, demo answers must show a subtle badge such as:

`Prototype demo answer`

A compact note below the sources says:

`Demo content for prototype testing. Production regulatory answers will be generated from approved, current sources.`

This prevents seeded content from being mistaken for live regulatory guidance.

## 7. Seeded demo question-and-answer engine

The prototype should work without network/API keys.

### 7.1 Matching behaviour

Normalise text by:

- lowercase
- trim whitespace
- remove punctuation where safe
- keyword matching

Exact and close keyword matches return a seeded answer.

Unknown questions return a polished fallback:

> This prototype is running with demo answers rather than the live MediQo knowledge system. Try one of the suggested questions below.

Then show 3–4 clickable demo questions.

### 7.2 Required seeded demo questions

#### Demo A — Accreditation certificates

Question examples:

- “For accreditation, what certificates do I need from our doctors?”
- “What GP certificates should I keep for RACGP accreditation?”

Response sections:

- CPR training
- AHPRA registration
- qualifications and credentials
- relevant training and competencies
- ongoing professional requirements

Related questions:

- How often does CPR need to be renewed?
- What staff training records do we need for accreditation?
- What evidence will surveyors ask to see for GPs?
- What credentials should I keep for nurses?
- Do locum doctors need the same certificates?

Demo source labels:

- RACGP Standards for general practices
- RACGP guidance on CPR in general practice
- Australian Resuscitation Council CPR guidance
- Medical Board of Australia registration standards

These are prototype labels only; do not fabricate clickable deep links in the demo if exact production URLs are not being validated.

#### Demo B — New receptionist attendance / employment issue

Question begins:

“I need some advice on a new receptionist. She is on her third week...”

Response structure:

- review employment status and entitlements
- keep clear records
- have a conversation
- consider next steps
- recommend Fair Work / employment advice where appropriate

Related resources:

- Managing employee absences
- Minimum employment period
- Unfair dismissal
- Ending employment

The response should be framed cautiously because employment termination is a high-risk category.

#### Demo C — Mandatory training

Question:

“What mandatory training should our receptionists complete?”

Response structure:

- identify role-specific and state-specific variation
- common practice training categories
- recommended evidence register
- suggest confirming obligations against practice circumstances

#### Demo D — Patient information sent to wrong recipient

Question:

“A patient’s information was emailed to the wrong person. What should I do?”

Response structure:

- contain the incident
- preserve evidence
- assess sensitivity and likely harm
- escalate internally
- determine whether OAIC / notification obligations may apply
- document actions

Use a high-risk callout that production guidance must come from current privacy sources.

#### Demo E — Create an onboarding checklist

Question:

“Create an onboarding checklist for a new receptionist.”

Return a checklist with categories:

- before first day
- first day
- first week
- systems and privacy
- patient communication
- billing/admin exposure
- safety
- probation/review

Include CTA:

`Open in Policy Library`

#### Demo F — DNA fee / Medicare

Question:

“Can we charge a DNA fee to a bulk-billed patient?”

Return a cautious demo answer with a clear note that production must validate current Medicare/billing requirements.

Show contextual CTA:

`MediQo MBS Billing Suggestions can help clinicians surface relevant billing opportunities during consults.`

Add `View MBS Billing Suggestions` link to the internal product page.

#### Demo G — “What changed this month?”

Question:

“Has anything changed this month that our practice needs to know about?”

Return mock alert summary cards clearly labelled demo:

- RACGP update
- Medicare update
- Modern Award update

CTA:

`Open Alerts Centre`

## 8. Two-free-question gate

### 8.1 Prototype behaviour

Anonymous users can submit two questions.

Persist locally:

- anonymous visitor id
- used question count
- timestamp

Storage:

- localStorage
- cookie mirror for the count / visitor token

After the second answered question, the third send attempt opens the signup modal.

The prototype should prevent easy accidental resetting across reloads in the same browser, while clearly recognising that production enforcement must be server-side and cannot rely only on client storage.

### 8.2 Signup modal

Follow the supplied two-column modal closely.

Left:

- “Create a free account to continue using MediQo”
- personalised for your practice
- built for Australian general practice
- access templates and tools

Right form:

- Clinic Name
- First Name
- Last Name
- Job Title
- Work Email
- Password
- Locations multi-select
- Create account button

Prototype submit:

- validate form
- show success state
- store a demo user locally
- unlock chat
- show toast `Demo account created`

Integration stub:

- `authService.createAccount`
- `leadService.submit`

Production HubSpot submission can replace the mock later.

## 9. Accreditation Assistant

This should feel like a meaningful module, not another chat tab.

Prototype sections:

- readiness score
- requirements summary
- evidence checklist
- gaps requiring attention
- upcoming expiries
- action list
- assigned owner
- due date

MVP demo dataset should include approximately 8–12 accreditation items with statuses:

- Ready
- Needs evidence
- Expiring soon
- Action required

Provide a top CTA:

`Ask accreditation question`

A side panel can explain the future evidence-upload and AI evidence-assessment workflow.

No hard-coding of the product architecture to one RACGP edition; store edition/version in data.

## 10. Policy Library

Tabs / filters:

- All
- Policies
- SOPs
- Checklists
- HR
- Accreditation
- Privacy

Seed templates:

- New Receptionist Onboarding Checklist
- Privacy Incident Response Procedure
- Staff Training Register
- Complaints Handling Procedure
- GP Onboarding Checklist
- Accreditation Evidence Checklist
- Social Media Policy
- Emergency / Business Continuity Checklist

Prototype actions:

- Preview
- Create from template
- Duplicate
- Save draft

Document creation workflow:

1. choose template
2. answer 3–5 short practice-specific questions
3. generate mock draft locally
4. edit in browser
5. save/export placeholder

## 11. Reports

Keep this intentionally simple because Elley requested no unnecessary dashboards.

Prototype cards:

- Accreditation Readiness Summary
- Policy Coverage Summary
- Training & Expiry Summary
- Recent Advice / Saved Answers

Reports use demo data and offer preview / download placeholder actions.

## 12. Alerts Centre

Accessible via bell and dedicated view.

Demo alert cards:

- RACGP update
- Medicare update
- Modern Award update

Each alert expands into:

- Does this affect us?
- What changed?
- What do we need to do?
- When do we need to do it?
- Sources

All seeded alerts visibly show `Demo alert`.

## 13. MediQo product pages

Create one reusable product-page template populated with Elley's exact product copy.

Products:

- AI Receptionist
- Scribe
- Document Sorter
- Care Plan Generation
- MBS Billing Suggestions
- Telehealth
- Online Bookings

Each page contains:

- small product badge
- headline
- supplied supporting copy
- Book a demo button
- Start a free trial button
- calendar embed placeholder styled like supplied screenshot

Prototype calendar:

- selectable date
- selectable demo time
- confirmation interaction
- note: `HubSpot meeting embed will replace this prototype calendar.`

Start free trial:

- opens signup/trial modal placeholder
- integration seam for future HubSpot embed

## 14. Product copy

Use Elley's supplied text exactly except for obvious spelling/spacing corrections that do not alter meaning.

### AI Receptionist

Headline: `Answer every patient call, book every patient appointment`

Body: `MediQo’s AI receptionists answer patient queries and book patient appointments directly into your practice management system – helping to relieve stress for busy admin teams and maximise revenue for the clinic.`

### Scribe

Headline: `Spend less time documenting, more time with patients`

Body: `MediQo Scribe captures and structures clinical notes in real time during patient consultations – helping doctors reduce documentation time, stay focused on patients and finish their day with less admin.`

### Document Sorter

Headline: `Sort every document, without the manual admin`

Body: `MediQo automatically identifies, categorises and matches incoming documents to the right patient and workflow – reducing hours of admin for reception teams and helping important information get where it needs to go faster.`

### Care Plan Generation

Headline: `Create comprehensive care plans, without the extra admin`

Body: `MediQo generates comprehensive, Medicare-compliant care plans in the background during patient consultations – helping doctors reduce documentation time while creating consistent, detailed plans that can be reviewed and edited before completion.`

### MBS Billing Suggestions

Headline: `Capture the right MBS items, at the right time`

Body: `MediQo identifies relevant MBS billing opportunities during the patient consultation – helping clinicians select appropriate item numbers, reduce missed billing opportunities and maximise eligible practice revenue.`

### Telehealth

Headline: `Telehealth consults, with a full suite of AI tools as well`

Body: `MediQo's telehealth is built for Australian healthcare — secure, encrypted, hosted in Australia, and built alongside a full suite of AI tools, so doctors can access scribe tools, MBS billing suggestions, history at a glance, and more, without switching between disconnected platforms.`

### Online Bookings

Headline: `Offer online bookings directly from your website`

Body: `MediQo Online Bookings lets patients find and book available appointments directly into your practice management system – saving you thousands in third-party booking costs, and reducing calls to reception while helping fill appointment books around the clock.`

## 15. Related questions and related resources

For seeded demo answers, the right rail updates contextually.

Related questions are clickable and immediately populate/submit the question.

Related resources show:

- title
- publisher
- external-link icon

In prototype mode, resource URLs should only be active when a known valid destination is provided. Otherwise they remain visually complete but marked `Demo resource` to avoid fabricated URLs.

## 16. Risk-aware answer presentation

High-risk categories:

- clinical scope of practice
- employment termination
- serious workplace matters
- privacy/data breaches
- professional registration
- Medicare compliance
- serious incidents
- legal disputes
- patient safety

Prototype responses in these categories include a restrained callout:

`This topic can require practice-specific professional or authority guidance. The production MediQo assistant will support its answer with current approved sources and indicate when direct confirmation is appropriate.`

Avoid generic disclaimer walls.

## 17. Accessibility and responsive requirements

- semantic landmarks
- labels for every field
- keyboard navigation across all primary actions
- visible focus states
- WCAG-friendly text contrast
- button labels readable by screen readers
- no interaction dependent only on colour
- modals trap focus and restore focus on close
- reduced-motion support
- responsive at 1440, 1024, 768, 390 widths
- mobile right rail collapses below answer
- sidebar becomes drawer
- composer remains easy to reach

## 18. Prototype persistence

Persist locally:

- anonymous visitor id
- free question count
- mock user profile
- saved answers
- selected practice
- selected accreditation statuses if changed

Provide a development-only reset action in user menu:

`Reset prototype data`

This makes testing repeatable without exposing a prominent reset control in the main product flow.

## 19. Error and loading states

Required:

- assistant typing/loading state
- no-match demo fallback
- failed account creation mock state (developer toggle or validation state)
- empty alerts state
- empty saved answers state
- disabled submit while blank/loading
- retry action for simulated assistant failure

## 20. Testing strategy

Automated unit/component tests should cover:

- demo question matching
- free question counter
- third-question gate
- account unlock
- local persistence
- route rendering
- product-page data rendering
- signup validation

Manual QA checklist:

- navigation at desktop/mobile widths
- keyboard-only modal flow
- close modal with Escape
- reload preserves question count
- seeded questions return correct demo response
- unknown question returns fallback suggestions
- create demo account unlocks chat
- all product pages render correct headline/copy
- Connect your PMS placeholder works
- alerts bell works
- no broken logo layout if remote image is unavailable

## 21. Deliverable

The implementation deliverable will be one ZIP containing a complete runnable frontend project including:

- source code
- package.json
- README with VS Code instructions
- `.env.example` describing future integrations, with no secret keys required for demo
- demo data
- tests

Expected local run flow:

```bash
npm install
npm run dev
```

No backend or API key is required for the prototype demo.

## 22. Out of scope for this first ZIP

The first ZIP intentionally does not pretend to provide live production infrastructure for:

- real LLM calls
- controlled RAG ingestion
- source monitoring/crawling
- real RACGP/Medicare/Fair Work freshness engine
- real user authentication
- secure server-side two-question enforcement
- HubSpot account/lead creation
- real PMS connection
- Azure deployment

The UI/service boundaries must make these straightforward next-phase replacements rather than rewrites.
