# MediQo Practice Manager Architecture

## Purpose

This document describes the current production architecture and the engineering boundaries that guide ongoing development. It is intended to help reviewers understand why the system is structured as it is without requiring them to trace every implementation detail.

## System overview

MediQo preserves the validated browser experience while moving privileged work and persistent state into production services.

```text
Browser
  |
  |-- Supabase Auth
  |
  |-- MediQo API
       |
       |-- Netlify Functions
       |    |-- Q&A
       |    |-- Account sync
       |    |-- Accreditation
       |    |-- Evidence
       |    |-- Accreditation actions
       |    `-- Policy documents
       |
       |-- OpenAI
       |
       `-- Supabase
            |-- Postgres
            |-- Row Level Security
            `-- Storage / controlled application data
```

## Frontend boundary

The frontend is a browser-standard JavaScript application that retains the interaction model established during the prototype phase.

The browser is responsible for presentation, local UI state, navigation and authenticated client interactions. It is not the authority for privileged decisions such as anonymous-question entitlement, tenant access or accreditation assessment logic.

The current frontend is intentionally not being visually redesigned as part of backend productionisation.

## Authentication and tenancy

Supabase Auth provides account authentication.

A practice is the primary tenant. Users belong to practices through membership records, and practice-owned data is scoped through those memberships.

Row Level Security is used as a database-level boundary so tenant isolation does not depend only on frontend filtering.

## Server-side API

Netlify Functions provide the trusted boundary for operations that require credentials, privileged database access or deterministic server-owned rules.

Examples include:

- OpenAI requests
- account synchronisation
- anonymous-question entitlement
- accreditation assessment
- evidence operations
- accreditation actions
- policy-document persistence

Privileged service credentials are not intended to be shipped to browser code.

## AI boundary

OpenAI is called from server-side functions rather than directly from the browser.

The model is used for language generation where appropriate, while product rules, tenant access and accreditation state transitions remain application-owned.

This distinction matters in compliance-sensitive workflows: an LLM can assist with explanation and generation, but it should not silently become the source of truth for account permissions, accreditation status or evidence verification.

## Accreditation model

The current formal accreditation workspace is based on RACGP Standards for general practices — 5th edition.

Three concepts are deliberately separated:

1. **Readiness** — the current application assessment of a requirement.
2. **Verification/evidence** — what support exists for that assessment.
3. **Actions** — work assigned to close gaps or prepare for assessment.

Completing an action does not automatically make a requirement ready. Likewise, a positive user response is not treated as independently verified evidence.

This separation prevents administrative progress from being interpreted as proof of compliance.

## Controlled accreditation data

The client-supplied accreditation workbook is treated as a controlled build input.

The repository records:

- source filename
- client version
- required workbook sheets
- SHA-256 checksum
- normalized generated dataset
- regeneration scripts

Rows marked VALIDATE or HOLD are preserved as such rather than being guessed into a stronger classification.

## Database changes

Database changes are version-controlled under `supabase/migrations/`.

Migrations are preferred over dashboard-only edits so schema, policies and application assumptions remain reproducible and reviewable.

## Security principles

The architecture follows several baseline rules:

- privileged keys remain server-side
- practice data is tenant scoped
- RLS is part of the access-control boundary
- model output does not bypass application-owned rules
- controlled accreditation content retains provenance
- high-risk workflow states are represented conservatively
- secrets are supplied through environment configuration rather than committed source

See [SECURITY.md](SECURITY.md) for the repository security expectations.

## Known technical debt

The project evolved quickly from a presentation prototype into a working backend foundation. As a result, some orchestration and data-access modules are larger than the desired long-term shape.

These modules are being left stable while backend contracts and accreditation workflows continue to settle. Decomposition should happen by domain once those boundaries are stable, rather than introducing structural churn during active productionisation.

This is a deliberate sequencing decision, not an architectural end state.

## Documentation history

Earlier implementation plans and design notes are retained under:

- `docs/implementation/history/`
- `docs/architecture/history/`

They are historical working documents. This file and the current codebase should be treated as the higher-level description of the present architecture.
