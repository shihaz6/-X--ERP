# AlchemyX ERP

Order intake, clients, projects, invoices, subscriptions, timesheets and reporting for AlchemyX Global.

- `backend/` — Spring Boot 3.5 / Java 21, PostgreSQL via Flyway migrations, `$PORT` aware.
- `frontend/` — React 19 + Vite + Tailwind, built to static files.

## Hosting for free (recommended: one container)

The frontend is a static SPA, so it is baked into the Spring Boot jar at `src/main/resources/static`.
That gives you **one URL, one service, no CORS**:

```
Render free web service (Docker)  ──serves──▶  /          React app
        │                                      /api/**     Spring Boot
        └──▶ Neon free Postgres (external)
```

### 1. Create the database (Neon)

1. Sign up at [neon.com](https://neon.com) and create a project.
2. Copy the **pooled** connection string. Convert it to JDBC form:

   ```
   postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
      ↓
   DB_URL = jdbc:postgresql://ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```

Flyway creates the schema on first boot, so an empty database is fine.

### 2. Deploy the service (Render)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo. `render.yaml` is detected automatically and
   creates a free Docker web service from the root `Dockerfile`.
3. Fill the values marked `sync: false`. `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS` are not known
   until the service exists — leave them blank, then set them to the service URL
   (`https://alchemyx-erp.onrender.com`) and redeploy. `FRONTEND_URL` is what password-reset
   emails link to.
4. Open the app and sign in with the `BOOTSTRAP_ADMIN_*` account.
5. **Delete `BOOTSTRAP_ADMIN_PASSWORD`** from the Render dashboard and redeploy. It is only used
   to create the first Super Admin when the database has no members.

Build the image locally the same way Render does:

```bash
docker build -t alchemyx-erp .
docker run --rm -p 8080:8080 \
  -e DB_URL=jdbc:postgresql://host/db?sslmode=require \
  -e DB_USERNAME=... -e DB_PASSWORD=... \
  alchemyx-erp
```

### What the free tier actually gives you

| | Free limit | Consequence |
|---|---|---|
| Render web service | 512 MB RAM, 0.1 CPU, sleeps after 15 min idle | ~60 s cold start on the first request |
| Neon Postgres | 0.5 GB storage, autosuspends after 5 min | first query after idle is slow |
| Outbound email | Render blocks SMTP ports 25/465/587 | leave `MAIL_HOST` empty (emails are logged), or use an HTTP email API |

This is fine for a demo or a handful of users. It is not a production plan: 0.1 CPU will feel slow,
and a free tier can be reclaimed. Before storing real business data, back the database up
periodically (`pg_dump`) and move to a paid instance — the same image deploys unchanged.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | yes | Neon Postgres (`jdbc:postgresql://…?sslmode=require`) |
| `DB_POOL_SIZE` | no | Hikari pool size, default `5`; use `3` on free plans |
| `FRONTEND_URL` | yes | Base URL used in password-reset links |
| `CORS_ALLOWED_ORIGINS` | no | Only needed if the frontend is on a different origin |
| `BOOTSTRAP_ADMIN_*` | first boot | Creates the first Super Admin |
| `APP_TIMEZONE` | no | Scheduler timezone, default `Asia/Colombo` |
| `MAIL_*`, `MAIL_FROM` | no | SMTP delivery; empty `MAIL_HOST` logs instead of sending |
| `JAVA_TOOL_OPTIONS` | no | `-XX:MaxRAMPercentage=60 -XX:+UseSerialGC` avoids OOM kills at 512 MB |
| `PORT` | set by host | Server port, default `8080` |

## Local development

Backend (needs Java 21, Maven, and a Postgres):

```bash
cd backend
export DB_URL='jdbc:postgresql://localhost:5432/postgres'
export DB_USERNAME=postgres
export DB_PASSWORD=postgres
mvn spring-boot:run          # http://localhost:8080
```

On PowerShell use `$env:DB_URL='...'` instead of `export`.

Frontend (needs Node 22 + pnpm 10.34.3):

```bash
cd frontend
pnpm install
pnpm dev                     # http://localhost:8443, talks to localhost:8080
```

Set `VITE_API_URL` in `frontend/.env.local` to point the dev app at another API host.
An empty value means "same origin".

## Alternative: split hosting

The per-app Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile` + `nginx.conf`) still work if
you prefer a static host for the UI (e.g. Cloudflare Pages) and a separate API service. In that case
build the frontend with `VITE_API_URL=https://<api-host>` and set
`CORS_ALLOWED_ORIGINS=https://<ui-host>` on the backend.

## CI

`.github/workflows/ci.yml` runs backend tests, frontend type-check + build, and builds the combined
Docker image on every push to `main`.
