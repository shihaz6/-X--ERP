# AlchemyX ERP API (NestJS)

NestJS (TypeScript) rebuild of the Spring Boot backend in `../backend`. It talks to the same PostgreSQL
schema (Neon in production) and serves the same `/api` contract, so the web app and the AlchemyX Connect
phone app work against it unchanged.

## Run it

```bash
cd backend-nest
npm install
cp .env.example .env          # then fill in DATABASE_URL and, for the first start, BOOTSTRAP_ADMIN_*
npm run build
npm start                     # migrations run first, then the API listens on $PORT (default 8080)
```

`npm run migrate` applies the schema on its own. The SQL files in `migrations/` are the same as the
Spring project's Flyway files. A database that Flyway already migrated is recognised through its
`flyway_schema_history` table, so nothing is run twice.

## Tests

```bash
npm test                      # unit tests: dates, validation, roles, formatting, errors, config
```

End-to-end smoke test against a running API (creates test data, so use a non-production database):

```bash
BASE=http://localhost:8080 node test/e2e/smoke.mjs
```

The smoke test expects the bootstrap admin `test.admin` / `test-password-123` and a fresh database. It
exercises sign-in, clients, projects, orders, invoices and payments, PDFs, subscriptions, timesheets,
leave, documents with versions, settings, analytics, the workspace snapshot and role restrictions.

## What matches the Spring API

- All 57 business endpoints with the same paths, methods, request bodies and JSON shapes.
- Same error bodies (`{"error": "..."}`) and status codes, including 409 for database conflicts.
- Same role rules, business rules and audit entries.
- Same invoice numbering (`{YYYY}` prefix and counter, locked per transaction).
- Passwords are BCrypt, so existing accounts keep working. Sessions are opaque tokens stored as SHA-256.
- The daily billing (06:00) and overdue reminder (07:00) jobs run in the workspace timezone.

## Not included yet

- Serving the web app's static files from this service (the Spring jar did this). Host the web app
  separately or add static serving.
- A Dockerfile for this service. The Spring Dockerfile at the repo root still builds the Spring backend.
