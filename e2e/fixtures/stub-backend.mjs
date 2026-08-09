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

  sendJson(res, 404, { detail: `stub-backend: no fixture route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`stub-backend listening on http://127.0.0.1:${PORT}`);
});
