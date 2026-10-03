# MediQo prototype implementation notes

## What is local in this presentation build

The interface, navigation, seven product pages, demo calendar, Accreditation Assistant, Policy Library, Reports, Alerts Centre, question matching, seeded answers, saved-answer state, anonymous two-question allowance and account form are all local and deterministic. No patient data or production credentials are required.

## Production seams

The production phase can replace the local service modules under `src/services/` with authenticated services for MediQo accounts, Supabase or the selected database, HubSpot forms/meeting embeds, practice-management-system connections, source ingestion/RAG, alerts monitoring and the AI assistant. The UI calls these concepts through service boundaries rather than embedding provider logic in page renderers.

## Security note

The browser-only two-question counter is intentionally a presentation mechanism. Production enforcement must be server-side. Do not place privileged Supabase, HubSpot, PMS, model or Azure secrets in browser JavaScript.

## Architecture note

The execution environment used to assemble this ZIP had no npm registry DNS access. To guarantee that the delivered project could be built and tested here rather than shipping unverified dependency code, the presentation build uses browser-standard ES modules and a zero-dependency Node toolchain. `npm install` therefore completes without downloading packages. The source is modular so a later React migration is optional rather than required for adding backend services.
