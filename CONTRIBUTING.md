# Contributing

## Development workflow

MediQo is under active production development. Keep changes focused, reviewable and easy to verify.

1. Pull the latest `main`.
2. Create a focused branch for the change.
3. Keep database changes in version-controlled Supabase migrations.
4. Make the smallest coherent implementation change.
5. Run the project checks locally.
6. Review affected user flows.
7. Open a pull request with a concise explanation of what changed and why.

## Required checks

Run:

```bash
npm test
npm run build
npm run smoke
```

Do not report a change as verified unless those commands were actually run in the environment being reported.

## Pull request notes

A useful pull request description should cover, where relevant:

- what changed
- why the change is needed
- user-facing impact
- database or migration changes
- security/tenant implications
- accreditation/readiness implications
- QA performed
- any known follow-up work

## Database changes

Use `supabase/migrations/` for schema and policy changes.

Avoid dashboard-only production changes that cannot be reproduced from the repository.

When changing tenant-owned tables, review Row Level Security and practice ownership explicitly.

## Accreditation changes

The accreditation workflow is intentionally conservative.

Keep readiness, verification/evidence and actions separate. Do not make a completed task, positive self-report or generated response automatically imply compliance.

Controlled dataset rows marked VALIDATE or HOLD must not be silently reclassified.

## Documentation

Architecture and implementation documentation should explain important decisions and trade-offs rather than narrate obvious code.

Historical plans are retained under `docs/implementation/history/` and `docs/architecture/history/`; current behaviour is defined by the codebase, migrations and up-to-date top-level documentation.

## Commit messages

Prefer concise, specific messages that describe the engineering change.

Examples:

```text
feat(accreditation): add action ownership and due dates
fix(evidence): preserve selected files during rerender
test(accreditation): cover unknown applicability state
docs: clarify accreditation readiness boundaries
```
