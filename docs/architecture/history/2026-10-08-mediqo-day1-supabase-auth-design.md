# MediQo Day 1 - Supabase Auth and Tenancy Design

## Goal

Replace the prototype account identity with a real Supabase-backed account foundation while preserving the existing browser ES-module frontend and client-approved UI.

## Scope

Day 1 includes:

- Supabase project structure and version-controlled migration.
- Supabase Auth email/password account creation.
- Automatic creation of the user's profile, practice, and owner membership.
- Practice jurisdictions stored separately from future physical practice locations.
- Multi-user / multi-practice-capable membership schema.
- Initial roles: owner, admin, practice_manager, staff.
- Row Level Security for profiles, practices, memberships, and locations.
- Session restoration, sign in, and sign out in the existing UI.
- Runtime browser-safe configuration for the Supabase URL and publishable/anon key.
- Change the Riverside Medical Centre signup example from a real prefilled value to placeholder text.
- Preserve the existing HubSpot trial embed and all current product presentation behaviour.

Not included today:

- HubSpot API contact sync.
- OpenAI / Azure OpenAI.
- RAG / pgvector knowledge ingestion.
- Production Q&A persistence.
- Anonymous server-side two-question quota.
- Accreditation engine implementation.
- PMS API integration.

## Architecture

The existing browser ES-module application remains in place. Browser-safe Supabase configuration is exposed through a generated runtime config file. The browser loads Supabase JS lazily only when account functions are used.

Supabase Auth owns email/password/session state. Postgres owns application identity and tenancy:

- auth.users
- profiles
- practices
- practice_memberships
- practice_locations

A database trigger reacts to a MediQo practice signup and creates the profile, practice and owner membership. The trigger does not trust the requested role: every self-created practice starts with role owner.

## Signup metadata

The frontend sends only business-profile metadata with signup:

- account_kind = practice_signup
- first_name
- last_name
- job_title
- practice_name
- jurisdictions[]

The password remains exclusively inside Supabase Auth.

## Tenancy and RLS

A practice is the tenant. Users belong through practice_memberships. The schema does not hard-code one user to one practice.

RLS rules:

- Profiles: user can read/update only their own profile.
- Practices: active members can read.
- Practices: owner/admin/practice_manager can update.
- Practice locations: members can read; owner/admin/practice_manager can manage.
- Membership rows: active practice members can read; normal browser clients cannot directly create or mutate memberships.
- Helper functions are SECURITY DEFINER and use an explicit search_path.

## Session/UI behaviour

The app keeps prototype state only for presentation features that have not yet been migrated. Supabase session identity becomes the source of truth when Supabase is configured.

Anonymous users see a Sign in action. Signed-in users get a Sign out action. Session restoration happens on startup. If email confirmation is enabled and signup returns no session, the UI tells the user to confirm email rather than pretending the account is already signed in.

## Environment

Browser-safe:

- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY (preferred)
- SUPABASE_ANON_KEY (legacy fallback)
- APP_URL

Server-only secrets must never be emitted into runtime-config.js.

## Safety constraints

- No service-role key in browser code.
- No Azure/OpenAI key in browser code.
- No HubSpot private token in browser code.
- No patient-identifiable-data fields introduced.
- Keep the live HubSpot trial and meeting embeds unchanged.
