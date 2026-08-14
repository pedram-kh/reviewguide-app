import { createServer } from "node:http";

/**
 * Minimal stand-in for the real backend, used only by local (non-live) Playwright runs of
 * customer-panel.spec.ts (SPRINT_05.md ticket 5.3). Exists because /app's initial render is a
 * Server Component that calls BACKEND_URL directly from the Next.js Node process — a call
 * Playwright's page.route() cannot see or intercept, since that only covers requests the browser
 * itself makes. Pointing BACKEND_URL at this stub for the local Playwright webServer (see
 * playwright.config.ts) is the only way to control what that first render sees without a real
 * Postgres-backed backend and a seeded test customer.
 *
 * Every *client-side* fetch (search, connect, settings, alerts refresh) goes through this app's
 * own /api/customer/* route handlers, which Playwright DOES intercept directly at the browser
 * layer — those are mocked per-test with page.route() instead, never routed through this stub.
 *
 * Fixtures are keyed by customer id (the session JWT's `sub` claim, read without verifying the
 * signature — this stub trusts nothing and holds no secrets, it only needs the claim as a lookup
 * key), NOT a single shared global. Playwright runs this same spec file once per project
 * (desktop-chromium, mobile-chromium) and those run in separate workers concurrently against this
 * one long-lived process — a single shared fixture object raced between them (caught live: one
 * project's setFixture landing between another's setFixture and its page.goto). Each test mints
 * its own unique customer id (e2e/fixtures/session.ts's mintSessionToken), so per-id fixtures give
 * every test its own isolated slice of state regardless of what else is running concurrently.
 */

const PORT = Number(process.env.STUB_BACKEND_PORT ?? 4009);

const DEFAULT_FIXTURE = {
  billingStatus: { subscription_status: "none", has_subscription_ever_started: false },
  customerState: {
    email: "e2e@example.com",
    notification_email: "e2e@example.com",
    tone_preference: "formal",
    connected_at: null,
    // Ticket 6.1: the real GET /api/customer/state always includes this, and the panel reads
    // `state.day_one.status` on first render — a fixture without it would throw before painting.
    day_one: { status: "not_started", summary: null },
    place: null,
  },
  alerts: [],
};

const fixturesByCustomerId = new Map();

const ADMIN_STATS = {
  total_leads: 0,
  ready_to_send: 0,
  sent_today: 0,
  replies: 0,
  places: 0,
  reviews: 0,
};

// Two runs: one ordinary, one that hit a per-customer daily cap (which the list must flag in red).
const ADMIN_RUNS = [
  {
    run_id: "run-capped-0000000000000000",
    started_at: "2026-08-13T12:00:00Z",
    finished_at: "2026-08-13T12:01:00Z",
    trigger_source: "scheduler",
    customers_polled: 2,
    records_fetched: 37,
    new_alerts: 6,
    emails_sent: 3,
    backfilled: 0,
    skipped: 1,
    deferred: 2,
    aborted: false,
    error_note: null,
  },
  {
    run_id: "run-quiet-00000000000000000",
    started_at: "2026-08-13T10:00:00Z",
    finished_at: "2026-08-13T10:00:20Z",
    trigger_source: "scheduler",
    customers_polled: 2,
    records_fetched: 4,
    new_alerts: 0,
    emails_sent: 0,
    backfilled: 0,
    skipped: 0,
    deferred: 0,
    aborted: false,
    error_note: null,
  },
];

const ADMIN_RUN_CUSTOMERS = {
  "run-capped-0000000000000000": [
    {
      customer_id: 42,
      email: "owner@example.com",
      place_name: "Testowa Restauracja",
      alerts: [
        {
          alert_id: 1,
          review_id: "rev-urgent",
          review_text: "Zimna zupa i długie czekanie.",
          review_rating: 2,
          review_date: "2026-08-13T09:00:00Z",
          response_text: "Bardzo nam przykro.",
          is_urgent: true,
          sent_at: "2026-08-13T12:00:30Z",
          postmark_message_id: "msg-urgent",
          generation_stop_reason: "end_turn",
          created_at: "2026-08-13T12:00:25Z",
        },
        {
          alert_id: 2,
          review_id: "rev-deferred",
          review_text: "Wszystko w porządku.",
          review_rating: 5,
          review_date: "2026-08-13T09:30:00Z",
          response_text: "Dziękujemy!",
          is_urgent: false,
          sent_at: null,
          postmark_message_id: null,
          generation_stop_reason: "end_turn",
          created_at: "2026-08-13T12:00:40Z",
        },
      ],
    },
  ],
};

// One alert attributed to a run, one historical row with run_id null — the customer page must
// group the first under a run header and fall back to the date for the second (ticket 6.4 D4).
const ADMIN_CUSTOMER_DETAIL = {
  customer_id: 42,
  email: "owner@example.com",
  notification_email: "owner@example.com",
  tone_preference: "formal",
  subscription_status: "trialing",
  created_at: "2026-07-01T09:00:00Z",
  connected_at: "2026-07-02T09:00:00Z",
  is_test: true,
  place: {
    place_id: "p1",
    name: "Testowa Restauracja",
    address: "ul. Testowa 1",
    rating: 4.2,
    last_polled_at: "2026-08-13T12:00:00Z",
  },
  alerts: [
    {
      alert_id: 1,
      review_id: "rev-urgent",
      review_text: "Zimna zupa i długie czekanie.",
      review_rating: 2,
      review_date: "2026-08-13T09:00:00Z",
      response_text: "Bardzo nam przykro.",
      is_urgent: true,
      kind: "alert",
      sent_at: "2026-08-13T12:00:30Z",
      postmark_message_id: "msg-urgent",
      generation_stop_reason: "end_turn",
      created_at: "2026-08-13T12:00:25Z",
      run_id: "run-capped-0000000000000000",
    },
    {
      alert_id: 99,
      review_id: "rev-historical",
      review_text: "Stara recenzja sprzed migracji 010.",
      review_rating: 4,
      review_date: "2026-07-20T09:00:00Z",
      response_text: "Dziękujemy za opinię.",
      is_urgent: false,
      kind: "digest",
      sent_at: "2026-07-20T10:00:00Z",
      postmark_message_id: "msg-old",
      generation_stop_reason: "end_turn",
      created_at: "2026-07-20T09:30:00Z",
      run_id: null,
    },
  ],
  recent_delivery_statuses: [],
};

function customerIdFromAuthHeader(req) {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) return null;
  try {
    const json = Buffer.from(payloadSegment, "base64url").toString("utf-8");
    const payload = JSON.parse(json);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function fixtureFor(customerId) {
  if (!fixturesByCustomerId.has(customerId)) {
    fixturesByCustomerId.set(customerId, structuredClone(DEFAULT_FIXTURE));
  }
  return fixturesByCustomerId.get(customerId);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "POST" && url.pathname === "/__fixtures__/set") {
    const body = await readBody(req).catch(() => ({}));
    const { customerId, ...overrides } = body;
    if (!customerId) return sendJson(res, 400, { detail: "customerId is required" });
    fixturesByCustomerId.set(customerId, { ...fixtureFor(customerId), ...overrides });
    return sendJson(res, 200, { ok: true });
  }

  const customerId = customerIdFromAuthHeader(req);

  if (req.method === "GET" && url.pathname === "/api/billing/status") {
    return sendJson(res, 200, fixtureFor(customerId ?? "anonymous").billingStatus);
  }

  if (req.method === "GET" && url.pathname === "/api/customer/state") {
    return sendJson(res, 200, fixtureFor(customerId ?? "anonymous").customerState);
  }

  if (req.method === "GET" && url.pathname === "/api/customer/alerts") {
    return sendJson(res, 200, { alerts: fixtureFor(customerId ?? "anonymous").alerts });
  }

  // --- /admin fixtures (ticket 6.4's runs UI) --------------------------------------------------
  //
  // Static rather than per-test, unlike the customer fixtures above: /admin has no session to key
  // on (it is HTTP Basic Auth, one shared identity), and these pages are read-only, so every test
  // can safely look at the same data. Kept deliberately small — just enough shape to prove the
  // pages render what the API returns.

  if (req.method === "GET" && url.pathname === "/api/admin/stats") {
    return sendJson(res, 200, ADMIN_STATS);
  }

  if (req.method === "GET" && url.pathname === "/api/admin/runs") {
    return sendJson(res, 200, ADMIN_RUNS);
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/admin/runs/")) {
    const runId = decodeURIComponent(url.pathname.slice("/api/admin/runs/".length));
    const run = ADMIN_RUNS.find((candidate) => candidate.run_id === runId);
    if (!run) return sendJson(res, 404, { detail: `no such run ${runId}` });
    return sendJson(res, 200, { ...run, customers: ADMIN_RUN_CUSTOMERS[runId] ?? [] });
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/admin/customers/")) {
    return sendJson(res, 200, ADMIN_CUSTOMER_DETAIL);
  }

  sendJson(res, 404, { detail: `stub-backend: no fixture route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`stub-backend listening on http://127.0.0.1:${PORT}`);
});
