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
      // Ticket 6.17 (partner feedback 11+12): this test is the pay-then-connect order — already
      // eligible, connecting now — the one order day-one still legitimately fires for and the
      // hero may honestly say "monitoring aktywny" (this test's whole point is the progress→ready
      // transition, not the subscription gate itself; that gate gets its own dedicated tests
      // below, "customer panel — subscription gate").
      billingStatus: { subscription_status: "trialing", has_subscription_ever_started: true },
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
    await expect(page.getByText("monitoring aktywny")).toBeVisible();
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

const PANEL_STATE = {
  email: "panel-e2e@example.com",
  notification_email: "panel-e2e@example.com",
  tone_preference: "formal",
  connected_at: new Date().toISOString(),
  day_one: {
    status: "done",
    summary: {
      fetched_from_api: true,
      reviews_considered: 3,
      reviews_qualifying: 3,
      drafts_generated: 3,
      digest_sent: true,
      capped: false,
      cap_error: null,
    },
  },
  place: {
    place_id: "p-panel",
    name: "Bar Panelowy",
    address: "ul. Panelowa 3",
    rating: 4.4,
    last_polled_at: new Date().toISOString(),
  },
};

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const PANEL_ALERTS = [
  {
    alert_id: 1,
    review_id: "r-today-urgent",
    review_text: "Zimna zupa dzisiaj.",
    review_rating: 2,
    review_date: daysAgo(0),
    response_text: "Bardzo nam przykro za dzisiejszą wizytę.",
    is_urgent: true,
    kind: "alert",
    sent_at: null,
    created_at: daysAgo(0),
  },
  {
    alert_id: 2,
    review_id: "r-today-ok",
    review_text: "Pyszne pierogi dzisiaj.",
    review_rating: 5,
    review_date: daysAgo(0),
    response_text: "Dziękujemy za dzisiejszą opinię!",
    is_urgent: false,
    kind: "digest",
    sent_at: null,
    created_at: daysAgo(0),
  },
  {
    alert_id: 3,
    review_id: "r-older",
    review_text: "Wczoraj było tłoczno.",
    review_rating: 4,
    review_date: daysAgo(3),
    response_text: "Cieszymy się, że zajrzeli Państwo mimo tłoku.",
    is_urgent: false,
    kind: "digest",
    sent_at: null,
    created_at: daysAgo(3),
  },
];

async function openPanel(page: import("@playwright/test").Page, email = "panel-e2e@example.com") {
  const customerId = uniqueCustomerId();
  await setFixture(customerId, {
    customerState: { ...PANEL_STATE, email, notification_email: email },
    billingStatus: { subscription_status: "trialing", has_subscription_ever_started: true },
    alerts: PANEL_ALERTS,
  });
  await loginAs(page, email, customerId);
  await page.goto("/app");
  return customerId;
}

test.describe("customer panel — ticket 6.9 restructure", () => {
  test("account menu opens and closes (drawer on mobile, dropdown on desktop)", async ({
    page,
  }, testInfo) => {
    const email = "menu-e2e@example.com";
    await openPanel(page, email);
    const isMobile = testInfo.project.name === "mobile-chromium";

    if (isMobile) {
      await page.getByRole("button", { name: "Otwórz menu" }).click();
      const menu = page.getByRole("dialog", { name: "Menu konta" });
      await expect(menu).toBeVisible();
      await expect(menu.getByText(email)).toBeVisible();
      await expect(menu.getByRole("link", { name: "Ustawienia" })).toBeVisible();
      await expect(menu.getByRole("button", { name: "Zarządzaj subskrypcją" })).toBeVisible();
      await expect(menu.getByRole("button", { name: "Wyloguj" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    } else {
      await page.getByRole("button", { name: `Konto ${email}` }).click();
      const menu = page.getByRole("menu", { name: "Menu konta" });
      await expect(menu).toBeVisible();
      await expect(menu.getByText(email)).toBeVisible();
      await expect(menu.getByRole("link", { name: "Ustawienia" })).toBeVisible();
      await expect(menu.getByRole("button", { name: "Zarządzaj subskrypcją" })).toBeVisible();
      await expect(menu.getByRole("button", { name: "Wyloguj" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    }
  });

  // Ticket 6.9a bug 1: the drawer's `position: fixed` panel/backdrop were nested inside the
  // sticky header, which has `backdrop-blur-xl` — a `backdrop-filter` ancestor becomes the
  // containing block for fixed descendants, so `inset: 0`/`height: calc(100% - 74px)` resolved
  // against the 74px header box instead of the viewport. Measured live: the backdrop painted as a
  // 412×74 rectangle pinned to the header corner and the panel as a same-corner sliver — "solid
  // white" in CSS but visually indistinguishable from transparent because almost none of the
  // screen was actually covered. Portaled to `document.body` in the fix; these assertions pin the
  // panel to a real, opaque, near-full-height overlay so a regression back into the header's
  // stacking context fails immediately.
  test("mobile drawer opens as a solid, near-full-height overlay with a visible backdrop (bug 1)", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "drawer variant only exists ≤768px");
    await openPanel(page, "drawer-geometry-e2e@example.com");
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("expected a viewport size on the mobile-chromium project");

    await page.getByRole("button", { name: "Otwórz menu" }).click();
    const panel = page.locator('[data-variant="drawer"]');
    await expect(panel).toBeVisible();
    // Let the enter transition finish so the assertions below read the settled, open state.
    await page.waitForTimeout(300);

    const geometry = await panel.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        top: rect.top,
        height: rect.height,
        parentIsBody: el.parentElement === document.body,
        backgroundColor: style.backgroundColor,
      };
    });
    // Not "rgba(0, 0, 0, 0)"/"transparent" — this is the exact regression: a fully opaque
    // `background: var(--card)` in the stylesheet that nonetheless painted nothing visible
    // because the element's box itself was squashed to a 74px-tall sliver by the containing-block
    // bug. Height is the real signal: it must cover the large majority of the viewport below the
    // header, not just a few dozen pixels.
    expect(geometry.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(geometry.parentIsBody).toBe(true);
    expect(geometry.top).toBeGreaterThanOrEqual(70);
    expect(geometry.top).toBeLessThanOrEqual(80);
    expect(geometry.height).toBeGreaterThan(viewport.height - 120);

    const backdrop = page.locator(".account-menu-backdrop");
    await expect(backdrop).toBeVisible();
    const backdropGeometry = await backdrop.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height, opacity: getComputedStyle(el).opacity };
    });
    expect(backdropGeometry.width).toBeGreaterThan(viewport.width - 10);
    expect(backdropGeometry.height).toBeGreaterThan(viewport.height - 10);
    expect(Number(backdropGeometry.opacity)).toBeGreaterThan(0.9);

    // Tap handling: tapping the backdrop (not the panel) closes the drawer.
    await backdrop.click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole("dialog", { name: "Menu konta" })).toHaveCount(0, { timeout: 2000 });
  });

  // Ticket 6.9a bug 2: `<Link href="/app?tab=ustawienia">` in the menu did update the URL, but
  // CustomerPanel's tab lived in `useState(initialTab)` — an initializer React only consults on
  // mount — so the already-mounted panel never actually switched tabs. Covers both menu variants
  // per the ticket ("from either menu variant").
  test("Ustawienia from the account menu activates the settings tab (bug 2, both variants)", async ({
    page,
  }, testInfo) => {
    const email = "menu-tab-e2e@example.com";
    await openPanel(page, email);
    const isMobile = testInfo.project.name === "mobile-chromium";

    if (isMobile) {
      await page.getByRole("button", { name: "Otwórz menu" }).click();
      await page.getByRole("dialog", { name: "Menu konta" }).getByRole("link", { name: "Ustawienia" }).click();
    } else {
      await page.getByRole("button", { name: `Konto ${email}` }).click();
      await page.getByRole("menu", { name: "Menu konta" }).getByRole("link", { name: "Ustawienia" }).click();
    }

    await expect(page).toHaveURL(/tab=ustawienia/);
    // The menu closes (part c of the fix) ...
    await expect(page.getByRole("dialog", { name: "Menu konta" })).toHaveCount(0);
    await expect(page.getByRole("menu", { name: "Menu konta" })).toHaveCount(0);
    // ... and the tab itself actually activates — not just the URL. Asserting on the *connected*
    // tab bar (not the disconnected account's standalone settings card, which has no tablist) is
    // the regression check: a fixture bug once made this pass against the wrong branch entirely.
    await expect(page.getByRole("tab", { name: "Ustawienia" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Adres e-mail do powiadomień")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Najnowsze" })).toHaveAttribute("aria-selected", "false");
  });

  test("browser back/forward switches tabs, not just clicks (bug 2)", async ({ page }) => {
    await openPanel(page, "back-forward-e2e@example.com");
    await expect(page.getByRole("tab", { name: "Najnowsze" })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("tab", { name: /Historia/ }).click();
    await expect(page).toHaveURL(/tab=historia/);
    await page.getByRole("tab", { name: "Ustawienia" }).click();
    await expect(page).toHaveURL(/tab=ustawienia/);

    await page.goBack();
    await expect(page).toHaveURL(/tab=historia/);
    await expect(page.getByRole("tab", { name: /Historia/ })).toHaveAttribute("aria-selected", "true");

    await page.goBack();
    await expect(page).not.toHaveURL(/tab=/);
    await expect(page.getByRole("tab", { name: "Najnowsze" })).toHaveAttribute("aria-selected", "true");

    await page.goForward();
    await expect(page).toHaveURL(/tab=historia/);
    await expect(page.getByRole("tab", { name: /Historia/ })).toHaveAttribute("aria-selected", "true");

    await page.goForward();
    await expect(page).toHaveURL(/tab=ustawienia/);
    await expect(page.getByRole("tab", { name: "Ustawienia" })).toHaveAttribute("aria-selected", "true");
  });

  test("tabs switch and stay in sync with the URL", async ({ page }) => {
    await openPanel(page);
    await expect(page.getByRole("tab", { name: "Najnowsze" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Zimna zupa dzisiaj.")).toBeVisible();
    // Older day's review must not appear on Najnowsze.
    await expect(page.getByText("Wczoraj było tłoczno.")).toHaveCount(0);

    await page.getByRole("tab", { name: /Historia/ }).click();
    await expect(page).toHaveURL(/tab=historia/);
    await expect(page.getByRole("tab", { name: /Historia/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("columnheader", { name: "Data" })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/tab=historia/);
    await expect(page.getByRole("tab", { name: /Historia/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("columnheader", { name: "Data" })).toBeVisible();

    await page.getByRole("tab", { name: "Ustawienia" }).click();
    await expect(page).toHaveURL(/tab=ustawienia/);
    await expect(page.getByText("Adres e-mail do powiadomień")).toBeVisible();
    await expect(page.getByRole("button", { name: "Zarządzaj subskrypcją" })).toBeVisible();
  });

  test("copy button flips to the green Skopiowano state, then reverts", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openPanel(page);
    const button = page.getByRole("button", { name: "Kopiuj" }).first();
    await button.click();
    const copied = page.getByRole("button", { name: "Skopiowano ✓" }).first();
    await expect(copied).toBeVisible();
    await expect(copied).toHaveAttribute("data-copied", "true");
    await expect(page.getByRole("button", { name: "Kopiuj" }).first()).toBeVisible({ timeout: 4000 });
    await expect(page.getByRole("button", { name: "Kopiuj" }).first()).toHaveAttribute("data-copied", "false");
  });

  test("Historia row click expands that day's review cards inline", async ({ page }) => {
    await openPanel(page);
    await page.getByRole("tab", { name: /Historia/ }).click();

    const newestRow = page.locator("[data-history-row]").first();
    await expect(newestRow).toHaveAttribute("data-expanded", "false");
    await newestRow.click();
    await expect(newestRow).toHaveAttribute("data-expanded", "true");
    await expect(page.getByText("Zimna zupa dzisiaj.")).toBeVisible();
    await expect(page.getByText("Pyszne pierogi dzisiaj.")).toBeVisible();
    // The older day stays collapsed.
    await expect(page.getByText("Wczoraj było tłoczno.")).toHaveCount(0);

    await newestRow.click();
    await expect(newestRow).toHaveAttribute("data-expanded", "false");
    await expect(page.getByText("Zimna zupa dzisiaj.")).toHaveCount(0);
  });
});

// Ticket 6.17 (partner feedback 11+12): connect-then-pay order, the partner's own reported bug —
// a place connected with no eligible (trialing/active) subscription must show inactive monitoring
// and a real, in-place activation CTA, never "monitoring aktywny" nor the generic "no alerts yet"
// empty state that implies the service is running when day-one has been gated (see
// app.jobs.day_one.claim_day_one_start on the backend).
test.describe("customer panel — subscription gate (ticket 6.17)", () => {
  const UNSUBSCRIBED_STATE = {
    email: "unsub-e2e@example.com",
    notification_email: "unsub-e2e@example.com",
    tone_preference: "formal",
    connected_at: new Date().toISOString(),
    // The exact shape the gate produces on the backend: connected, but day-one never claimed
    // (app.routers.customer.connect_place's `claim_day_one_start` returned False) because there
    // was no eligible subscription at connect time.
    day_one: { status: "not_started", summary: null },
    place: {
      place_id: "p-unsub",
      name: "Bar Bez Karty",
      address: "ul. Bez Karty 7",
      rating: 4.0,
      last_polled_at: null,
    },
  };

  async function openUnsubscribedPanel(page: import("@playwright/test").Page) {
    const customerId = uniqueCustomerId();
    await setFixture(customerId, {
      customerState: UNSUBSCRIBED_STATE,
      billingStatus: { subscription_status: "none", has_subscription_ever_started: false },
      alerts: [],
    });
    await loginAs(page, "unsub-e2e@example.com", customerId);
    await page.goto("/app");
    return customerId;
  }

  test("hero shows inactive monitoring and the primary activation CTA, not the trial-nudge link", async ({
    page,
  }) => {
    await openUnsubscribedPanel(page);

    await expect(page.getByText("Bar Bez Karty")).toBeVisible();
    await expect(page.getByText("monitoring nieaktywny — dodaj kartę, aby rozpocząć")).toBeVisible();
    await expect(page.getByText("monitoring aktywny")).toHaveCount(0);

    // The primary CTA is the real checkout form, right here — not a link into Ustawienia.
    await expect(page.getByText("Aktywuj monitoring")).toBeVisible();
    const activationButton = page.getByRole("button", { name: "Dodaj kartę, aby rozpocząć" });
    await expect(activationButton).toBeVisible();
    const activationForm = page.locator("form", { has: activationButton });
    await expect(activationForm).toHaveAttribute("action", "/api/billing/checkout");
    await expect(activationForm.locator('input[name="immediate_start_consent"]')).toHaveAttribute(
      "required",
      ""
    );
  });

  test("Najnowsze and Historia show the activation-aware empty state, not the generic one", async ({
    page,
  }) => {
    await openUnsubscribedPanel(page);

    await expect(page.getByText("Twoje odpowiedzi pojawią się po aktywacji.")).toBeVisible();
    await expect(page.getByText("Nie masz jeszcze żadnych alertów")).toHaveCount(0);

    await page.getByRole("tab", { name: /Historia/ }).click();
    await expect(page.getByText("Twoje odpowiedzi pojawią się po aktywacji.")).toBeVisible();
    await expect(page.getByText("Brak historii alertów.")).toHaveCount(0);
  });

  test("Ustawienia tab still offers the same activation CTA as a second access point", async ({
    page,
  }) => {
    await openUnsubscribedPanel(page);

    await page.getByRole("tab", { name: /Ustawienia/ }).click();
    const settingsButton = page.getByRole("button", { name: "Dodaj kartę, aby rozpocząć" });
    await expect(settingsButton).toBeVisible();
    const settingsForm = page.locator("form", { has: settingsButton });
    await expect(settingsForm).toHaveAttribute("action", "/api/billing/checkout");
  });
});

