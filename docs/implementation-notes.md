# MediQo implementation notes

## Current state

MediQo began as a presentation-ready prototype and is now being moved onto production services while keeping the validated product experience intact.

Current foundations include Supabase authentication, practice-scoped persistence, database policies, server-side question handling, OpenAI Q&A, version-controlled migrations, the RACGP 5th Edition accreditation workspace, evidence handling, gap analysis, accreditation actions, policy-document persistence and automated repository checks.

## Work still evolving

The main areas still being developed are broader source retrieval and governance, accreditation content validation, policy workflow expansion, PMS integrations, notifications and internal administration.

## Engineering principles

- Preserve validated product behaviour while replacing prototype-only services.
- Keep privileged operations on the server.
- Keep practice data scoped to the correct tenant.
- Keep accreditation readiness, evidence verification and remediation actions separate.
- Keep controlled accreditation source material traceable and reproducible.
- Version database changes in the repository.
- Run the real test, build and smoke commands before reporting a batch as verified.

## Prototype compatibility

Some browser-local state remains for presentation and UI convenience. Authoritative account, quota and persisted practice data belongs to the production backend.

## Further reading

See [ARCHITECTURE.md](../ARCHITECTURE.md), [SECURITY.md](../SECURITY.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

Historical design and implementation notes are retained under `docs/architecture/history/` and `docs/implementation/history/`.
