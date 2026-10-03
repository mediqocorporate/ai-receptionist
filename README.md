# MediQo AI Practice Manager Assistant

A presentation-ready MediQo practice-manager workspace based on Elley Nott's product brief and supplied UI direction. The project is intentionally self-contained: it runs locally without API keys, while keeping clear service seams for the production backend phase.

## Run in VS Code

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

There are no runtime dependencies in this presentation build, so `npm install` is fast and does not require a framework install.

## Test and build

```bash
npm test
npm run build
npm run smoke
```

`npm run build` creates `dist/`. `npm run smoke` verifies the root, Accreditation Assistant, Policy Library, Alerts Centre and AI Receptionist routes through the production-style SPA fallback.

## Key flows

- Ask a Question: click a suggested question or type one of the prepared practice-manager questions.
- Anonymous flow: two supported questions are answered; the third supported submission opens account creation.
- Accreditation Assistant: review readiness, gaps, owners, due dates and change item status.
- Policy Library: filter templates, preview one, create a local draft and edit/save it.
- Reports: preview or download a local text report.
- Alerts Centre: expand RACGP, Medicare and Modern Award sample alerts.
- Product pages: AI Receptionist, Scribe, Document Sorter, Care Plan Generation, MBS Billing Suggestions, Telehealth and Online Bookings share the supplied MediQo product-page layout and working calendar interaction.
- Connect your PMS: opens the prepared PMS connection handoff screen.

The sample regulatory answers and alerts are clearly labelled so they cannot be confused with current verified guidance.

## Local reset

When running on `localhost` or `127.0.0.1`, open the Practice Manager menu at the bottom-left and choose **Reset local data**. This clears the local question counter, saved answers, demo user and accreditation overrides.

## Netlify

1. Push this folder to GitHub.
2. In Netlify, import the GitHub repository.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. `netlify.toml` already includes SPA fallback routing.

No environment variables are needed for the presentation build.

## Production phase

`.env.example` lists planned integration names. The service modules under `src/services/` are the replacement points for real account/auth, HubSpot, PMS, alerts, knowledge/RAG and assistant APIs. Browser-only free-question enforcement is not production security and must be replaced by server-side enforcement.
