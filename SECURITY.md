# Security

## Scope

This document records the current repository security expectations for the MediQo Practice Manager application. It is not a claim of external certification or formal compliance.

## Security principles

- Privileged credentials must never be exposed in browser code.
- Practice-owned data must remain tenant scoped.
- Supabase Row Level Security is part of the access-control boundary.
- OpenAI requests are made from trusted server-side functions.
- Service-role access is reserved for trusted server operations.
- Sensitive configuration is supplied through environment variables.
- Accreditation evidence and workflow data are practice scoped.
- Model output must not override application-owned permission or readiness rules.

## Secrets

Do not commit real values for:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- HubSpot private-app tokens
- PMS credentials
- other privileged integration secrets

Browser-safe runtime configuration and server-only secrets must remain clearly separated.

## Tenant isolation

A MediQo practice is treated as a tenant. Application code and database policies should both assume that one practice must not be able to read or modify another practice's private data.

New tables containing practice-owned data should be reviewed for:

- a clear practice/tenant relationship
- appropriate Row Level Security
- least-privilege write paths
- server-side validation where privileged operations are required

## Patient-identifiable information

The current production foundation should not be treated as approval to deliberately process patient-identifiable clinical information.

Before that scope is enabled, MediQo should confirm the required privacy wording, retention/deletion rules, hosting and data-residency expectations, intended clinical use cases and any additional governance controls.

## AI and accreditation safety

Accreditation readiness, evidence verification and remediation actions are separate concepts.

The application should not infer compliance or certification from:

- a completed action
- a positive self-reported answer alone
- unverified source material
- model-generated interpretation without the required application checks

Rows explicitly marked VALIDATE or HOLD in the controlled accreditation dataset must remain conservative until reviewed.

## Dependency and code review

Before merging a change:

```bash
npm test
npm run build
npm run smoke
```

Changes to authentication, RLS, service-role usage, evidence handling or accreditation assessment logic should receive focused review because they affect security or compliance-sensitive boundaries.

## Reporting security issues

Security concerns should be reported privately to the MediQo engineering team rather than opened as a public issue containing sensitive details.
