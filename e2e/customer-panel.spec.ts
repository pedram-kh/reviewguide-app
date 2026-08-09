import { expect, test } from "@playwright/test";

import { mintSessionToken } from "./fixtures/session";
import { SESSION_COOKIE_NAME } from "../lib/session";

/**
 * SPRINT_05.md ticket 5.3's own Cursor prompt: "Playwright: connect flow (mock search), copy
 * button, urgent badge rendering." Local-only (see playwright.config.ts's stub-backend webServer
 * entry and e2e/fixtures/stub-backend.mjs's docstring for why) — skipped when E2E_BASE_URL points
 * at a real deployment, since there's no fixture control over a live backend's data.
 */
test.skip(!!process.env.E2E_BASE_URL, "customer-panel fixtures only exist against the local stub backend");

const STUB_BASE = "http://127.0.0.1:4009";

// Every test mints its own unique customer id and stores its fixture under that id (see
// stub-backend.mjs's own docstring) — this file's tests run across two Playwright projects
// (desktop/mobile-chromium) concurrently against the SAME stub-backend process, so a shared
// fixture key would race between them; per-test ids make that impossible regardless of ordering.
let nextCustomerId = 1;
function uniqueCustomerId(): number {
  nextCustomerId += 1;
  return Date.now() + nextCustomerId;
}

async function setFixture(customerId: number, overrides: Record<string, unknown>): Promise<void> {
  await fetch(`${STUB_BASE}/__fixtures__/set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId: String(customerId), ...overrides }),
  });
}

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  customerId: number
): Promise<void> {
  const token = await mintSessionToken(email, customerId);
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      // Deliberately not `secure` — the local Playwright webServer runs plain HTTP, and a Secure
      // cookie would silently never be sent to it (real prod cookie IS Secure; see
      // app/api/auth/complete-verify/route.ts). Test-only relaxation, same posture as the
      // backend's own TEST_JWT_SECRET in tests/test_customer.py.
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

test.describe("customer panel — connect-restaurant flow", () => {
  test("connecting shows the in-progress card, then the ready card once day-one finishes", async ({
    page,
  }) => {
    // Ticket 6.1: connect-place answers 202 before the drafts exist, so "connected" and "drafts
    // ready" are two separate moments in the UI now. This walks both, driving the transition the way
    // production does — by changing what GET /api/customer/state reports between polls — rather than
    // asserting a single end state that would pass even if the progress card never rendered.
    const customerId = uniqueCustomerId();
    await setFixture(customerId, {
      customerState: {
        email: "connect-e2e@example.com",
        notification_email: "connect-e2e@example.com",
        tone_preference: "formal",
        connected_at: null,
        day_one: { status: "not_started", summary: null },
        place: null,
      },
    });
    await loginAs(page, "connect-e2e@example.com", customerId);

    await page.route("**/api/customer/search-place*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            { place_id: "p1", name: "Pizzeria Testowa", address: "ul. Testowa 1", rating: 4.6 },
          ],
        }),
      });
    });

    await page.route("**/api/customer/connect-place", async (route) => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          place_id: "p1",
          name: "Pizzeria Testowa",
          day_one_started: true,
        }),
      });
    });

    const connectedPlace = {
      place_id: "p1",
      name: "Pizzeria Testowa",
      address: "ul. Testowa 1",
      rating: 4.6,
      last_polled_at: null,
    };
    const stateBase = {
      email: "connect-e2e@example.com",
      notification_email: "connect-e2e@example.com",
      tone_preference: "formal",
      connected_at: new Date().toISOString(),
      place: connectedPlace,
    };

    // Flipped to `done` only after the in-progress card has been asserted, so the two states can't
    // be satisfied by one response.
    let dayOneFinished = false;
    await page.route("**/api/customer/state", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...stateBase,
          day_one: dayOneFinished
            ? {
                status: "done",
                summary: {
                  fetched_from_api: true,
                  reviews_considered: 3,
                  reviews_qualifying: 2,
                  drafts_generated: 2,
                  digest_sent: true,
                  capped: false,
                  cap_error: null,
                },
              }
            : { status: "running", summary: null },
        }),
      });
    });

    await page.route("**/api/customer/alerts", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ alerts: [] }) });
    });

    await page.goto("/app");
    await expect(page.getByText("Nie masz jeszcze połączonej restauracji")).toBeVisible();

    await page.getByPlaceholder(/Nazwa restauracji/).fill("Pizzeria");
    await expect(page.getByRole("button", { name: /Pizzeria Testowa/ })).toBeVisible();

    await page.getByRole("button", { name: /Pizzeria Testowa/ }).click();
    await expect(page.getByText("Potwierdź restaurację")).toBeVisible();
    await expect(page.getByText("ul. Testowa 1")).toBeVisible();
    await expect(page.getByText("★ 4.6")).toBeVisible();

    await page.getByRole("button", { name: "Połącz" }).click();

    // The connect landed and the panel says so honestly: connected, drafts still being written.
    await expect(page.getByText("Restauracja połączona — przygotowujemy odpowiedzi")).toBeVisible();
    await expect(page.getByText("Połączona restauracja")).toBeVisible();
    await expect(page.getByText("Pizzeria Testowa").first()).toBeVisible();
    // The finished-run card must NOT be claiming anything yet.
    await expect(page.getByText("Odpowiedzi gotowe!")).toHaveCount(0);

    dayOneFinished = true;

    // Arrives via the panel's own poll, no reload — the thing the customer never got before.
    await expect(page.getByText("Odpowiedzi gotowe!")).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText("Wysłaliśmy e-mail z 2 gotowymi odpowiedziami na najnowsze recenzje.")
    ).toBeVisible();
    await expect(page.getByText("Restauracja połączona — przygotowujemy odpowiedzi")).toHaveCount(0);
  });
});

test.describe("customer panel — alerts list", () => {
  const CONNECTED_STATE = {
    email: "alerts-e2e@example.com",
    notification_email: "alerts-e2e@example.com",
    tone_preference: "formal",
    connected_at: new Date().toISOString(),
    // A returning customer whose day-one finished long ago: `done`, and no `justConnected` in this
    // session, so neither the progress nor the ready card shows — only the alerts list under test.
    day_one: {
      status: "done",
      summary: {
        fetched_from_api: true,
        reviews_considered: 1,
        reviews_qualifying: 1,
        drafts_generated: 1,
        digest_sent: true,
        capped: false,
        cap_error: null,
      },
    },
    place: {
      place_id: "p-alerts",
      name: "Bar Alertowy",
      address: "ul. Alertowa 2",
      rating: 4.2,
      last_polled_at: new Date().toISOString(),
    },
  };

  test("copy button copies the draft response to the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const customerId = uniqueCustomerId();
    await setFixture(customerId, {
      customerState: CONNECTED_STATE,
      alerts: [
        {
          alert_id: 1,
          review_id: "r1",
          review_text: "Świetna obsługa!",
          review_rating: 5,
          review_date: new Date().toISOString(),
          response_text: "Dziękujemy bardzo za miłe słowa!",
          is_urgent: false,
          kind: "digest",
          sent_at: null,
          created_at: new Date().toISOString(),
        },
      ],
    });
    await loginAs(page, "alerts-e2e@example.com", customerId);

    await page.goto("/app");
    await expect(page.getByText("Dziękujemy bardzo za miłe słowa!")).toBeVisible();

    await page.getByRole("button", { name: "Kopiuj" }).click();
    await expect(page.getByRole("button", { name: "Skopiowano ✓" })).toBeVisible();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe("Dziękujemy bardzo za miłe słowa!");
  });

  test("urgent alerts show a PILNE badge, non-urgent ones don't", async ({ page }) => {
    const customerId = uniqueCustomerId();
    await setFixture(customerId, {
      customerState: CONNECTED_STATE,
      alerts: [
        {
          alert_id: 1,
          review_id: "r-urgent",
          review_text: "Znalazłem włos w zupie.",
          review_rating: 1,
          review_date: new Date().toISOString(),
          response_text: "Bardzo nam przykro, prosimy o kontakt.",
          is_urgent: true,
          kind: "alert",
          sent_at: null,
          created_at: new Date().toISOString(),
        },
        {
          alert_id: 2,
          review_id: "r-normal",
          review_text: "Bardzo smaczne dania.",
          review_rating: 5,
          review_date: new Date().toISOString(),
          response_text: "Dziękujemy za wizytę!",
          is_urgent: false,
          kind: "digest",
          sent_at: null,
          created_at: new Date().toISOString(),
        },
      ],
    });
    await loginAs(page, "badge-e2e@example.com", customerId);

    await page.goto("/app");

    const urgentItem = page.locator("li", { hasText: "Znalazłem włos w zupie." });
    await expect(urgentItem.getByText("PILNE")).toBeVisible();

    const normalItem = page.locator("li", { hasText: "Bardzo smaczne dania." });
    await expect(normalItem.getByText("PILNE")).toHaveCount(0);
  });
});
