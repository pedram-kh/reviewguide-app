# reviewguide-app

Internal admin dashboard for [ReviewPilot](https://github.com/pedram-kh/Review-AI) (the
`reviewpilot-backend` repo). Next.js 16 (App Router, TypeScript, Tailwind v4), deployed on
Netlify. Built per `docs/sprints/SPRINT_03.md` ticket 3.2 in the backend repo — that repo's
`/docs` folder (`WORKFLOW.md`, `LOGIC.md`, `ROADMAP.md`, `PROGRESS.md`, `/sprints`) is the single
source of truth for product rules and sprint status; this README only covers running/deploying
*this* app.

## What's here (ticket 3.2 scope)

- `/` — minimal placeholder page.
- `/admin/*` — gated by HTTP Basic Auth (`middleware.ts`, `ADMIN_USER` / `ADMIN_PASS`).
- `/admin` — stats cards (leads by status, sent today, sent by channel, replies) read live from
  the backend's `GET /api/admin/stats`.
- `lib/api.ts` — the only place that talks to the backend. Marked `server-only` so it can never
  be imported into a Client Component and bundled into browser JS. `ADMIN_API_KEY` is read from
  the server environment and sent as `X-Admin-Key`; it never appears in `NEXT_PUBLIC_*` and never
  reaches the browser.
- The leads table/detail workspace is ticket 3.3 (built) — see the git log for that ticket's
  scope; this section only covers 3.2.

## What's here (ticket 4.2 scope — magic-link auth)

Customer-facing pages, entirely separate audience/theme from `/admin` (dark, matching
`reviewguide-marketing`'s landing — SPRINT_04.md's explicit dark-theme note, "no theme seam"):

- `/signup`, `/login` — same email-only form (`app/(customer)/EmailAuthForm.tsx`); passwordless
  auth doesn't distinguish the two until the emailed link is clicked. Submits to
  `app/api/auth/request-link/route.ts`, which proxies server-side to the backend's
  `POST /api/auth/request-link`. Shows a "Sprawdź skrzynkę" confirmation in place — there's
  nowhere to navigate to until the email arrives.
- `/auth/verify` (`app/auth/verify/route.ts`) — where the emailed link actually points. Calls the
  backend's `POST /api/auth/verify`, and on success sets an `httpOnly`, `Secure`, `SameSite=lax`
  session cookie (the JWT the backend returns, stored verbatim — no separate session store) and
  redirects to `/app`. On failure (expired/used/invalid token), redirects to `/login?error=...`
  with a human-readable message.
- `/app` — protected. `middleware.ts` gates it by verifying the session cookie's JWT signature
  locally (via `jose`, using `AUTH_JWT_SECRET` — Edge-runtime compatible, unlike most JWT
  libraries) and redirects to `/login` if missing/invalid/expired; the page itself re-verifies
  independently rather than trusting middleware ran, same "don't trust the frontend" posture as
  the admin API. Shows the logged-in email; ticket 4.3 adds the subscription status card here.
  Includes a "Wyloguj" (log out) button/route — not explicitly in the ticket, but the minimum
  needed to actually test/use the auth system without waiting out a 30-day cookie.
- `lib/authApi.ts` — server-only client for the backend's public auth endpoints (no `X-Admin-Key`
  needed, but still routed through this app's server, never called from the browser directly).
- `lib/session.ts` — the shared JWT-verify helper `middleware.ts` and `/app` both use.

## Environment variables

| Var | Where | Purpose |
|---|---|---|
| `ADMIN_USER` | server only | Basic Auth username for `/admin/*` |
| `ADMIN_PASS` | server only | Basic Auth password for `/admin/*` |
| `BACKEND_URL` | server only | FastAPI base URL, no trailing slash (e.g. `https://reviewpilot-backend.awsapprunner.com`) |
| `ADMIN_API_KEY` | server only | Must match the backend's `ADMIN_API_KEY` exactly; sent as the `X-Admin-Key` header |
| `AUTH_JWT_SECRET` | server only | Must match the backend's `AUTH_JWT_SECRET` exactly; verifies the customer session cookie locally (ticket 4.2) |

Copy `.env.example` to `.env.local` for local dev and fill in real values. None of these are
`NEXT_PUBLIC_*` — they're only ever read on the server (middleware, Server Components,
`lib/api.ts`, `lib/authApi.ts`), never bundled for the browser.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in ADMIN_USER / ADMIN_PASS / BACKEND_URL / ADMIN_API_KEY
npm run dev                  # http://localhost:3000
```

`BACKEND_URL` can point at a local `uvicorn` instance of `reviewpilot-backend` (default
`http://localhost:8000`) or the deployed App Runner URL.

### Verifying the admin key never reaches the client bundle

```bash
npm run build
grep -R "ADMIN_API_KEY\|<the literal key value>" .next/static || echo "clean: not found in client bundle"
```

The build only inlines env vars prefixed `NEXT_PUBLIC_`, and `server-only` in `lib/api.ts` makes
the build fail outright if that file is ever imported from client code — so there are two
independent guards against the key leaking, not just a convention.

## Deploying to Netlify

1. Create a Netlify site linked to this GitHub repo (`pedram-kh/reviewguide-app`).
2. Site settings → Environment variables → add `ADMIN_USER`, `ADMIN_PASS`, `BACKEND_URL`,
   `ADMIN_API_KEY`, `AUTH_JWT_SECRET` (production values — never commit these; `AUTH_JWT_SECRET`
   must be the exact same value as the backend's App Runner env var of the same name, or every
   session this app issues will fail to verify).
3. Build command `npm run build`, publish directory `.next` (see `netlify.toml`; the
   `@netlify/plugin-nextjs` plugin handles the Next.js App Router / middleware / server
   components).
4. Deploy. Visit `/admin` — the browser should prompt for Basic Auth before showing anything.
   Visit `/signup` — should show the dark email form (not the light `/admin` theme).

**Not yet deployed as of this ticket** (see `docs/PROGRESS.md` row 4.2 in the backend repo):
this session built, tested, and committed ticket 4.2 end-to-end against a local backend, but did
not push `AUTH_JWT_SECRET` to this app's or the backend's production environment, and did not set
a real `POSTMARK_TOKEN` anywhere — per this session's explicit instruction to stop short of
anything that would send real email. Wiring the live env vars is a separate, disclosed next step.

## Relationship to the backend repo

This app never touches the database directly. Every read/write goes through
`reviewpilot-backend`'s `/api/admin/*` routes, authenticated with `X-Admin-Key`. See that repo's
`docs/LOGIC.md` §3 (status lifecycle) and §6 (outreach constraints) for the rules this UI must
respect as later tickets (3.3+) add the leads workspace.
