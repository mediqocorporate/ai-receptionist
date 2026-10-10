# MediQo AI Practice Manager Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, runnable React/Vite MediQo prototype that closely follows Elley's supplied designs, supports realistic seeded chat demos and the two-free-question signup gate, and preserves clean seams for later AI, RAG, HubSpot, PMS, authentication, and Azure integrations.

**Architecture:** A route-driven React/TypeScript single-page app uses a reusable MediQo application shell, feature-scoped pages, typed demo datasets, local service adapters, and a small persistence layer. All prototype behavior is deterministic and local; production integrations sit behind stable service interfaces so future replacements do not require page rewrites.

**Tech Stack:** React, TypeScript, Vite, React Router, Vitest, React Testing Library, jsdom, Lucide React, CSS variables + modular CSS, browser localStorage/cookies.

**Spec:** `docs/superpowers/specs/2026-10-04-mediqo-ai-practice-assistant-design.md`

## Global Constraints

- Primary visual references: Elley's supplied MediQo screenshots, then existing MediQo Partner Platform, then the Interface Lexicon.
- Primary font: Inter with system fallbacks.
- Do not use a heavyweight UI framework.
- The prototype must run with `npm install` then `npm run dev` and require no backend/API keys.
- Use the hosted MediQo logo asset when available and a text fallback when unavailable.
- Left navigation must include: Ask a Question, Accreditation Assistant, Policy Library, Reports, AI Receptionist, Scribe, Document Sorter, Care Plan Generation, MBS Billing Suggestions, Telehealth, Online Bookings.
- Top bar must include `Connect your PMS`, Alerts, Help, and the user avatar/menu.
- Anonymous users receive two answered questions; the third send attempt opens signup.
- User chat messages render on the right; assistant answers render wide with sources, related questions, and related resources.
- Seeded regulatory/compliance answers must display `Prototype demo answer` and the prototype-content note from the spec.
- High-risk seeded answers must display the restrained risk-awareness callout from the spec.
- Production integration boundaries must exist for assistant, auth, lead, PMS, alerts, and knowledge services.
- Responsive target widths: 1440, 1024, 768, 390 px.
- Modal behavior must include focus trap, Escape close, and focus restoration.
- Do not invent deep external source URLs when exact valid URLs are not supplied.
- Development-only user-menu action: `Reset prototype data`.
- Elley's product-page copy is used exactly except obvious spelling/spacing fixes that do not change meaning.

## Review Focus

- **Remote logo failure:** layout remains intact and shows a readable MediQo wordmark fallback; covered in Task 1 component test.
- **Question-count tampering/reload behavior:** same-browser reload preserves the anonymous count and third-question gate; covered in Task 4 persistence tests.
- **Unknown or punctuation-heavy questions:** normalization safely routes known paraphrases and returns fallback for unsupported text; covered in Task 3 matcher tests.
- **Keyboard-only modal use:** focus stays inside signup/PMS dialogs, Escape closes, and focus returns to the opener; covered in Task 9 accessibility tests.
- **Small-screen overflow:** chat rail, sidebar, product calendar, and signup modal remain usable at 390 px without horizontal page scrolling; covered in Task 9 responsive/manual QA.

---

## File Structure

```text
mediqo-ai-practice-assistant/
├── public/
│   └── favicon.svg
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── routes.ts
│   ├── components/
│   │   ├── shell/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── chat/
│   │   │   ├── ChatComposer.tsx
│   │   │   ├── ChatConversation.tsx
│   │   │   ├── AssistantAnswer.tsx
│   │   │   ├── RelatedRail.tsx
│   │   │   └── SourceBlock.tsx
│   │   ├── dialogs/
│   │   │   ├── Dialog.tsx
│   │   │   ├── SignupDialog.tsx
│   │   │   └── PmsDialog.tsx
│   │   ├── product/
│   │   │   ├── ProductHero.tsx
│   │   │   └── DemoCalendar.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       ├── Toast.tsx
│   │       └── EmptyState.tsx
│   ├── pages/
│   │   ├── AskQuestionPage.tsx
│   │   ├── AccreditationPage.tsx
│   │   ├── PolicyLibraryPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── AlertsPage.tsx
│   │   └── ProductPage.tsx
│   ├── data/
│   │   ├── demoQuestions.ts
│   │   ├── accreditation.ts
│   │   ├── policies.ts
│   │   ├── reports.ts
│   │   ├── alerts.ts
│   │   └── products.ts
│   ├── services/
│   │   ├── assistantService.ts
│   │   ├── authService.ts
│   │   ├── leadService.ts
│   │   ├── pmsService.ts
│   │   ├── alertsService.ts
│   │   └── knowledgeService.ts
│   ├── hooks/
│   │   ├── usePrototypeState.ts
│   │   └── useToast.ts
│   ├── lib/
│   │   ├── persistence.ts
│   │   ├── questionMatcher.ts
│   │   └── validation.ts
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── globals.css
│   │   ├── shell.css
│   │   ├── chat.css
│   │   └── features.css
│   ├── test/
│   │   └── setup.ts
│   └── main.tsx
├── tests/
│   ├── app-shell.test.tsx
│   ├── question-matcher.test.ts
│   ├── ask-question-flow.test.tsx
│   ├── signup-gate.test.tsx
│   ├── persistence.test.ts
│   ├── routes.test.tsx
│   ├── product-pages.test.tsx
│   └── accessibility-dialog.test.tsx
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── netlify.toml
```

### Task 1: Project Foundation, Brand Tokens, Shell, and Routing

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`
- Create: `src/app/App.tsx`, `src/app/router.tsx`, `src/app/routes.ts`
- Create: `src/components/shell/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `UserMenu.tsx`
- Create: `src/styles/tokens.css`, `globals.css`, `shell.css`
- Create: `src/test/setup.ts`, `tests/app-shell.test.tsx`, `tests/routes.test.tsx`

**Interfaces:**
- Produces: `APP_ROUTES: readonly RouteDefinition[]`, `AppShell`, route-level outlet area, stable sidebar item IDs/paths.
- Produces: CSS custom properties for MediQo colors, spacing, radii, typography, shadows, focus rings.

- [ ] **Step 1: Write failing shell/routing tests**

Assert that the rendered shell contains the MediQo logo or fallback, practice selector, all required navigation labels, `Connect your PMS`, Alerts, Help, avatar, and that `/`, `/accreditation`, `/policies`, `/reports`, `/alerts`, and `/products/ai-receptionist` render the expected page heading placeholder.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- app-shell.test.tsx routes.test.tsx`

Expected: FAIL because the app shell/routes do not yet exist.

- [ ] **Step 3: Scaffold Vite/React/TypeScript and implement route definitions**

Create route definitions with exact required labels/paths and a reusable `AppShell` using React Router `Outlet`.

- [ ] **Step 4: Implement MediQo tokens and shell styling**

Use the spec's Inter stack, core palette, restrained borders/shadows, desktop sidebar, responsive drawer base styles, and selected purple navigation state.

- [ ] **Step 5: Implement hosted-logo fallback behavior**

`Sidebar` should attempt `https://partners.mediqo.health/wp-content/uploads/2025/11/Vector-1.png`; on image error, replace it with a text wordmark without shifting navigation.

- [ ] **Step 6: Run tests**

Run: `npm test -- app-shell.test.tsx routes.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: scaffold MediQo app shell and routing"
```

### Task 2: Typed Demo Data and Production-Ready Service Seams

**Files:**
- Create: `src/data/demoQuestions.ts`, `accreditation.ts`, `policies.ts`, `reports.ts`, `alerts.ts`, `products.ts`
- Create: `src/services/assistantService.ts`, `authService.ts`, `leadService.ts`, `pmsService.ts`, `alertsService.ts`, `knowledgeService.ts`
- Create: `src/lib/validation.ts`
- Create: `tests/product-pages.test.tsx` data assertions section

**Interfaces:**
- Produces: `DemoAnswer`, `DemoQuestion`, `RelatedQuestion`, `RelatedResource`, `SourceRef`, `RiskLevel`, `ProductDefinition`, `AccreditationItem`, `PolicyTemplate`, `AlertItem` types.
- Produces: `assistantService.ask(question: string, context: AssistantContext): Promise<AssistantResult>`.
- Produces: `authService.createAccount(payload: SignupPayload): Promise<AuthResult>`.
- Produces: `leadService.submit(payload: SignupPayload): Promise<void>`.
- Produces: `pmsService.connect(): Promise<{ status: 'demo' }>`.
- Produces: `alertsService.list(): Promise<AlertItem[]>`.
- Produces: `knowledgeService.getSources(answerId: string): Promise<SourceRef[]>`.

- [ ] **Step 1: Add failing data-contract tests**

Assert there are exactly seven product definitions with Elley's specified headlines/body copy, at least seven seeded demo answer groups, 8–12 accreditation items, the required policy templates, and the three required demo alert categories.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- product-pages.test.tsx`

Expected: FAIL because datasets/services are missing.

- [ ] **Step 3: Implement typed datasets**

Encode the exact product copy, seeded demo questions/answers, related questions/resources, demo source labels, high-risk flags, alerts, accreditation statuses, policy templates, and simple report definitions.

- [ ] **Step 4: Implement local service adapters**

Services return Promise-based local data with small artificial delays where useful, but no network calls or secrets.

- [ ] **Step 5: Run tests**

Run: `npm test -- product-pages.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data src/services src/lib/validation.ts tests/product-pages.test.tsx
git commit -m "feat: add MediQo demo data and service contracts"
```

### Task 3: Demo Question Matcher and Ask-a-Question Conversation Experience

**Files:**
- Create: `src/lib/questionMatcher.ts`
- Create: `src/components/chat/ChatComposer.tsx`, `ChatConversation.tsx`, `AssistantAnswer.tsx`, `RelatedRail.tsx`, `SourceBlock.tsx`
- Create: `src/pages/AskQuestionPage.tsx`
- Create: `src/styles/chat.css`
- Create: `tests/question-matcher.test.ts`, `tests/ask-question-flow.test.tsx`

**Interfaces:**
- Consumes: `DemoQuestion[]` and `assistantService.ask` from Task 2.
- Produces: `normalizeQuestion(input: string): string`.
- Produces: `matchDemoQuestion(input: string, questions: DemoQuestion[]): DemoQuestion | null`.
- Produces: Ask-a-Question page with empty state, six suggestion cards, conversation state, related rail, loading state, source block, helpful/save controls.

- [ ] **Step 1: Write failing matcher tests**

Test exact phrasing, capitalization/punctuation variants, key paraphrases for accreditation certificates and receptionist attendance, and one unsupported question returning `null`.

- [ ] **Step 2: Run matcher tests and verify failure**

Run: `npm test -- question-matcher.test.ts`

Expected: FAIL because matcher functions are missing.

- [ ] **Step 3: Implement matcher**

Normalize lowercase/whitespace/punctuation and score aliases/keyword groups deterministically; do not use fuzzy network services.

- [ ] **Step 4: Run matcher tests**

Run: `npm test -- question-matcher.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing Ask-a-Question flow tests**

Assert empty/home state heading, six cards, submit behavior, right-aligned user message, loading indicator, `Prototype demo answer` badge, sources, related rail, clickable related question submission, and polished no-match fallback with 3–4 suggestions.

- [ ] **Step 6: Run flow tests and verify failure**

Run: `npm test -- ask-question-flow.test.tsx`

Expected: FAIL because chat components/page are missing.

- [ ] **Step 7: Implement conversation UI**

Match supplied screenshots: wide assistant response, user bubble on right, sticky composer, source panel, related questions/resources rail, contextual internal CTA for MBS answer, and alert-opening CTA for monthly-change answer.

- [ ] **Step 8: Run flow tests**

Run: `npm test -- ask-question-flow.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/questionMatcher.ts src/components/chat src/pages/AskQuestionPage.tsx src/styles/chat.css tests/question-matcher.test.ts tests/ask-question-flow.test.tsx
git commit -m "feat: add interactive MediQo demo chat"
```

### Task 4: Prototype Persistence, Two-Free-Question Gate, and Signup Flow

**Files:**
- Create: `src/lib/persistence.ts`
- Create: `src/hooks/usePrototypeState.ts`
- Create: `src/components/dialogs/Dialog.tsx`, `SignupDialog.tsx`
- Create: `src/components/ui/Toast.tsx`, `src/hooks/useToast.ts`
- Create: `tests/persistence.test.ts`, `tests/signup-gate.test.tsx`
- Modify: `src/pages/AskQuestionPage.tsx`, `src/components/shell/UserMenu.tsx`

**Interfaces:**
- Produces: `PrototypeState` with `visitorId`, `freeQuestionCount`, `user`, `savedAnswerIds`, `selectedPractice`, accreditation overrides.
- Produces: `loadPrototypeState(): PrototypeState`, `savePrototypeState(state: PrototypeState): void`, `resetPrototypeState(): void`.
- Produces: `usePrototypeState()` actions: `recordAnsweredQuestion`, `createDemoUser`, `saveAnswer`, `reset`.

- [ ] **Step 1: Write failing persistence tests**

Assert initial anonymous state, visitor ID persistence, free-question count persistence after reload simulation, cookie mirror creation, and reset behavior.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- persistence.test.ts`

Expected: FAIL because persistence layer does not exist.

- [ ] **Step 3: Implement persistence layer and hook**

Store JSON in localStorage and a small same-browser cookie mirror for visitor/count; parsing must safely recover from malformed stored JSON.

- [ ] **Step 4: Run persistence tests**

Run: `npm test -- persistence.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing gate/signup tests**

Assert first two questions are answered, third submit opens signup, invalid form blocks submit, valid form calls `authService.createAccount` and `leadService.submit`, unlocks chat, stores demo user, and displays `Demo account created` toast.

- [ ] **Step 6: Run gate tests and verify failure**

Run: `npm test -- signup-gate.test.tsx`

Expected: FAIL because gate/signup behavior is missing.

- [ ] **Step 7: Implement signup UI and gate integration**

Follow supplied two-column modal closely; fields: Clinic Name, First Name, Last Name, Job Title, Work Email, Password, Locations. Add left-side three-benefit list and gradient CTA.

- [ ] **Step 8: Add development-only reset action**

Place `Reset prototype data` in user menu only; show confirmation then clear prototype state.

- [ ] **Step 9: Run gate tests**

Run: `npm test -- signup-gate.test.tsx`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/persistence.ts src/hooks src/components/dialogs src/components/ui/Toast.tsx src/pages/AskQuestionPage.tsx src/components/shell/UserMenu.tsx tests/persistence.test.ts tests/signup-gate.test.tsx
git commit -m "feat: add free-question gate and demo signup"
```

### Task 5: Accreditation Assistant Workspace

**Files:**
- Create: `src/pages/AccreditationPage.tsx`
- Add supporting components under: `src/components/accreditation/`
- Modify: `src/styles/features.css`
- Add tests to: `tests/routes.test.tsx`

**Interfaces:**
- Consumes: `AccreditationItem[]`, prototype persistence overrides.
- Produces: readiness summary, 8–12-item evidence/action table, status controls, upcoming expiry panel, gap list, `Ask accreditation question` CTA.

- [ ] **Step 1: Write failing accreditation route/UI test**

Assert readiness summary, status labels `Ready`, `Needs evidence`, `Expiring soon`, `Action required`, version/edition display, owner/due date columns, and the question CTA.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- routes.test.tsx`

Expected: FAIL for accreditation assertions.

- [ ] **Step 3: Implement workspace**

Use calm card/table layout, not a dense dashboard; edits to statuses persist via prototype state.

- [ ] **Step 4: Add evidence-assessment future-flow side panel**

Explain the future upload → AI assessment → gaps/actions flow without claiming it is live.

- [ ] **Step 5: Run tests**

Run: `npm test -- routes.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AccreditationPage.tsx src/components/accreditation src/styles/features.css tests/routes.test.tsx
git commit -m "feat: add accreditation readiness workspace"
```

### Task 6: Policy Library, Local Document Builder, and Reports

**Files:**
- Create: `src/pages/PolicyLibraryPage.tsx`, `ReportsPage.tsx`
- Create: `src/components/policies/TemplateCard.tsx`, `DocumentWizard.tsx`, `DocumentEditor.tsx`
- Modify: `src/styles/features.css`
- Add tests to: `tests/routes.test.tsx`

**Interfaces:**
- Consumes: policy/report demo datasets.
- Produces: policy filters/tabs, template preview/create/duplicate/save interactions, 3–5-question local wizard, editable generated draft, report cards.

- [ ] **Step 1: Write failing policy/report tests**

Assert required template names, category filters, wizard steps, editable generated draft, save-draft toast, and four report cards.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- routes.test.tsx`

Expected: FAIL for policy/report assertions.

- [ ] **Step 3: Implement Policy Library**

Create exact filters from the spec and seed all required template cards.

- [ ] **Step 4: Implement local document wizard/editor**

A chosen template asks 3–5 short fields, then produces a deterministic editable draft; `Open in Policy Library` from onboarding demo should deep-link/select the onboarding template.

- [ ] **Step 5: Implement Reports page**

Render Accreditation Readiness Summary, Policy Coverage Summary, Training & Expiry Summary, Recent Advice / Saved Answers with preview/download placeholder feedback.

- [ ] **Step 6: Run tests**

Run: `npm test -- routes.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PolicyLibraryPage.tsx src/pages/ReportsPage.tsx src/components/policies src/styles/features.css tests/routes.test.tsx
git commit -m "feat: add policy library and reports"
```

### Task 7: Alerts Centre, Help/Top-Bar Interactions, and PMS Placeholder

**Files:**
- Create: `src/pages/AlertsPage.tsx`
- Create: `src/components/dialogs/PmsDialog.tsx`
- Modify: `src/components/shell/TopBar.tsx`
- Modify: `src/styles/features.css`
- Add tests to: `tests/app-shell.test.tsx`, `tests/routes.test.tsx`

**Interfaces:**
- Consumes: `alertsService.list()` and `pmsService.connect()`.
- Produces: bell popover, unread count, dedicated Alerts page, expandable demo alert details, PMS placeholder dialog.

- [ ] **Step 1: Write failing interaction tests**

Assert bell opens recent alerts, `View all alerts` routes to Alerts page, each alert expands to the four required question headings plus sources, and `Connect your PMS` opens the placeholder dialog.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- app-shell.test.tsx routes.test.tsx`

Expected: FAIL for new interactions.

- [ ] **Step 3: Implement alert popover and Alerts page**

Seed RACGP, Medicare, and Modern Award demo cards with `Demo alert` labels.

- [ ] **Step 4: Implement PMS placeholder**

Keep copy concise: PMS connection will be configured in a later phase; do not imply current connectivity.

- [ ] **Step 5: Run tests**

Run: `npm test -- app-shell.test.tsx routes.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AlertsPage.tsx src/components/dialogs/PmsDialog.tsx src/components/shell/TopBar.tsx src/styles/features.css tests/app-shell.test.tsx tests/routes.test.tsx
git commit -m "feat: add alerts centre and PMS placeholder"
```

### Task 8: Reusable MediQo Product Pages and Demo Calendar

**Files:**
- Create: `src/pages/ProductPage.tsx`
- Create: `src/components/product/ProductHero.tsx`, `DemoCalendar.tsx`
- Modify: `src/app/router.tsx`, `src/styles/features.css`
- Expand: `tests/product-pages.test.tsx`

**Interfaces:**
- Consumes: `ProductDefinition` by slug.
- Produces: one reusable layout for all seven products, demo-date/time selection, confirmation state, signup/trial dialog trigger.

- [ ] **Step 1: Write failing page-rendering tests**

For every product slug assert exact headline/body, `Book a demo`, `Start a free trial`, calendar heading, date/time controls, and confirmation behavior.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- product-pages.test.tsx`

Expected: FAIL because page/calendar are missing.

- [ ] **Step 3: Implement reusable page and hero**

Match supplied AI Receptionist screenshot: centred badge/headline/body, two CTAs, large calendar panel below, active sidebar product.

- [ ] **Step 4: Implement prototype calendar**

Date and time selection are local and deterministic; confirmation shows selected slot. Include subtle `HubSpot meeting embed will replace this prototype calendar.` note outside the main hero hierarchy.

- [ ] **Step 5: Wire trial CTA**

Reuse signup/trial dialog architecture; no HubSpot embed yet, but keep a dedicated integration slot/component boundary.

- [ ] **Step 6: Run tests**

Run: `npm test -- product-pages.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/ProductPage.tsx src/components/product src/app/router.tsx src/styles/features.css tests/product-pages.test.tsx
git commit -m "feat: add MediQo product demo pages"
```

### Task 9: Accessibility, Responsive Behavior, Error/Loading States, and Polishing

**Files:**
- Create: `tests/accessibility-dialog.test.tsx`
- Modify: `src/components/dialogs/Dialog.tsx`
- Modify: `src/styles/globals.css`, `shell.css`, `chat.css`, `features.css`
- Modify affected components for ARIA/keyboard states.

**Interfaces:**
- Produces: focus-trapped reusable dialog behavior, mobile sidebar drawer, right-rail stacking, reduced-motion rules, disabled/loading/retry/empty states.

- [ ] **Step 1: Write failing dialog accessibility tests**

Assert first focus target, Tab/Shift+Tab focus wrap, Escape close, `aria-modal`, dialog label, and opener focus restoration.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- accessibility-dialog.test.tsx`

Expected: FAIL until dialog behavior is complete.

- [ ] **Step 3: Implement robust dialog keyboard behavior**

Keep implementation dependency-free and reusable for signup/PMS dialogs.

- [ ] **Step 4: Implement required loading/error/empty states**

Add assistant typing state, simulated assistant retry path, empty alerts, empty saved answers, blank/loading disabled submit, validation errors, and mock account failure toggle isolated to development.

- [ ] **Step 5: Implement responsive layouts**

At <=1024 adjust rails/spacing, <=768 use drawer and stacked layouts, at 390 ensure no page-level horizontal scrolling and usable composer/calendar/modal.

- [ ] **Step 6: Add reduced-motion and visible-focus rules**

Honor `prefers-reduced-motion`; all interactive elements must show keyboard focus without relying on color alone.

- [ ] **Step 7: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src tests/accessibility-dialog.test.tsx
git commit -m "feat: polish accessibility and responsive states"
```

### Task 10: Netlify Readiness, Documentation, Production-Seam Notes, and Final Verification

**Files:**
- Create: `.env.example`, `README.md`, `netlify.toml`, `.gitignore`
- Modify: `package.json`
- Create/update: `docs/implementation-notes.md`

**Interfaces:**
- Produces: documented local run/build/test commands and future environment placeholders.

- [ ] **Step 1: Add environment placeholder contract**

`.env.example` includes named placeholders for future Supabase, HubSpot, AI/RAG, PMS, and optional Azure integration values, with no real secrets.

- [ ] **Step 2: Add Netlify SPA configuration**

Configure Vite build output and fallback routing for React Router.

- [ ] **Step 3: Write README**

Document:
- Node/npm prerequisite
- `npm install`
- `npm run dev`
- `npm test`
- `npm run build`
- Netlify deployment steps
- prototype data reset location
- what is local/demo vs future production integration

- [ ] **Step 4: Build and verify**

Run: `npm run build`

Expected: successful production build with no TypeScript errors.

- [ ] **Step 5: Run complete automated suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Run preview smoke check**

Run: `npm run preview -- --host 127.0.0.1`

Verify the root route and at least `/accreditation`, `/policies`, `/alerts`, and `/products/ai-receptionist` load correctly via SPA routing.

- [ ] **Step 7: Manual QA at required widths**

Check 1440, 1024, 768, 390 px for navigation, composer, chat rail, accreditation table/cards, policy wizard, product calendar, and signup modal.

- [ ] **Step 8: Final content QA**

Verify no visible `demo`, `presentation`, `placeholder`, or `coming soon` language appears in ordinary product UI except the intentional prototype-safety labels/notes required by the spec and internal future-integration notes.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: prepare MediQo prototype for handoff"
```

- [ ] **Step 10: Package deliverable**

Create `mediqo-ai-practice-assistant.zip` from the verified project directory, excluding `node_modules`, build cache, and git metadata. Include source, tests, README, `.env.example`, and Netlify config.
