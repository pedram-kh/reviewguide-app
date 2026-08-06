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
- The leads table/detail workspace is ticket 3.3 — **not built yet**, deliberately.

## Environment variables

| Var | Where | Purpose |
|---|---|---|
| `ADMIN_USER` | server only | Basic Auth username for `/admin/*` |
| `ADMIN_PASS` | server only | Basic Auth password for `/admin/*` |
| `BACKEND_URL` | server only | FastAPI base URL, no trailing slash (e.g. `https://reviewpilot-backend.awsapprunner.com`) |
| `ADMIN_API_KEY` | server only | Must match the backend's `ADMIN_API_KEY` exactly; sent as the `X-Admin-Key` header |

Copy `.env.example` to `.env.local` for local dev and fill in real values. None of these are
`NEXT_PUBLIC_*` — they're only ever read on the server (middleware, Server Components,
`lib/api.ts`), never bundled for the browser.

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
   `ADMIN_API_KEY` (production values — never commit these).
3. Build command `npm run build`, publish directory `.next` (see `netlify.toml`; the
   `@netlify/plugin-nextjs` plugin handles the Next.js App Router / middleware / server
   components).
4. Deploy. Visit `/admin` — the browser should prompt for Basic Auth before showing anything.

## Relationship to the backend repo

This app never touches the database directly. Every read/write goes through
`reviewpilot-backend`'s `/api/admin/*` routes, authenticated with `X-Admin-Key`. See that repo's
`docs/LOGIC.md` §3 (status lifecycle) and §6 (outreach constraints) for the rules this UI must
respect as later tickets (3.3+) add the leads workspace.
