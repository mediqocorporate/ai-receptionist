# MediQo AI Practice Manager Assistant

MediQo's Practice Manager workspace combines authenticated practice accounts, live OpenAI Q&A, server-side anonymous-question limits, persisted conversations and the RACGP 5th Edition Accreditation Assistant foundation.

## Local development

Requirements: Node.js 20+ and npm.

Create a project-root `.env.local` with browser-safe Supabase values plus server-only secrets:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

OPENAI_API_KEY=YOUR_OPENAI_KEY
OPENAI_MODEL=gpt-6-luna

MEDIQO_ASSISTANT_API_URL=/api/ask
MEDIQO_ACCOUNT_SYNC_API_URL=/api/account-sync
MEDIQO_ACCREDITATION_API_URL=/api/accreditation

APP_URL=http://localhost:8888
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` in browser code or commit them.

Install and run through Netlify Dev so local API rewrites and functions are available:

```bash
npm install
npm run build
npx netlify dev --port 8888
```

Open `http://localhost:8888`.

## Test, build and smoke

```bash
npm test
npm run build
npm run smoke
```

`npm run build` creates `dist/`. The smoke test verifies the main SPA routes through the production-style fallback.

## Supabase migrations

The repository keeps every database change under `supabase/migrations/`.

After pulling a commit containing new migrations, review the listed migration names and apply them to the linked project:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

For the accreditation MVP, the new migrations are:

- `202610090002_accreditation_foundation.sql`
- `202610090003_accreditation_racgp5_dataset.sql`

The first creates the versioned accreditation schema, practice-scoped state and RLS. The second seeds the controlled RACGP 5th Edition dataset generated from the client workbook.

## Accreditation dataset

The controlled source is the client-supplied workbook:

`MediQo_Accreditation_MVP_Readiness_Question_Dataset.xlsx`

Its provenance and SHA-256 are recorded in:

`data/accreditation/source/README.md`

The checked-in normalized build asset is:

`data/accreditation/generated/accreditation-dataset.json`

To regenerate it from the exact client workbook:

```bash
node scripts/import-accreditation-dataset.mjs /path/to/MediQo_Accreditation_MVP_Readiness_Question_Dataset.xlsx data/accreditation/generated/accreditation-dataset.json
node scripts/generate-accreditation-sql.mjs data/accreditation/generated/accreditation-dataset.json supabase/migrations/202610090003_accreditation_racgp5_dataset.sql
```

Rows marked **VALIDATE** remain `UNVERIFIED`; MediQo does not guess whether they are Mandatory or Aspirational. `RACGP5-QI2-1C` is **HOLD** and inactive until accreditation-content validation is completed.

The workbook is a developer build asset. VALIDATE/HOLD content is **not production-certified accreditation advice**.

## Accreditation safety model

The current formal workspace is **RACGP Standards for general practices — 5th edition**.

MediQo uses four readiness states only:

- Appears Ready
- Needs Attention
- Confirmed Gap
- Not Checked

Verification is stored separately from readiness. A user's positive answer is initially **User reported** and does not automatically make a requirement Appears Ready. “I'm not sure” remains **Not Checked**.

The browser does not calculate accreditation readiness. It renders assessment output produced by the server-side deterministic assessment engine.

Future standards/readiness versions use a separate `FUTURE_READINESS` workspace type and must not be mixed into current RACGP 5th Edition readiness.

## Key flows

- **Ask MediQo:** live OpenAI answers through `/api/ask`, with previous turns retained in the active conversation.
- **Anonymous Q&A:** exactly two successful answers; the third attempted question requires account creation.
- **Accounts:** Supabase Auth email/password with tenant practice membership.
- **Accreditation Assistant:** authenticated RACGP 5th Edition workspace with Quick Readiness Check, requirement filters, controlled sources/evidence criteria and persisted responses.
- **Policy Library:** current template/draft workflow; AI document generation is a later production slice.
- **Connect your PMS:** UI/setup lead flow until PMS credentials and integration briefs are available.

## Accreditation browser acceptance check

After migrations are applied and Netlify Dev is running:

1. Sign in with a MediQo practice account.
2. Open **Accreditation Assistant**.
3. Confirm the page shows **RACGP 5th Edition**.
4. Start the **Quick Readiness Check**.
5. Answer one positive option, one negative option and one **I'm not sure** option.
6. Confirm coverage changes independently from readiness.
7. Open **Requirements** and confirm VALIDATE rows show **Validation required**.
8. Open a requirement and confirm source/evidence configuration is shown.
9. Refresh the browser and confirm saved progress remains.
10. Confirm the UI never claims pass/fail/compliant/certified status.

## Netlify

The repository's `netlify.toml` contains SPA/API rewrites. Configure the same server-only environment variables in Netlify before production deployment.

Do not deploy production secrets in `runtime-config.js`; only browser-safe runtime configuration is emitted there.
