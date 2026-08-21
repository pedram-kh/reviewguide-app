import { expect, test } from "@playwright/test";

import { E2E_ADMIN_PASS, E2E_ADMIN_USER } from "../playwright.config";

/**
 * Ticket 6.18 — the admin customer detail page's is_test toggle. The panel's first write
 * action: ends the "manual UPDATE over the bastion tunnel" era for the recurring mis-flag
 * (customers 16, 18/19, 20, 25/26 all shipped as `is_test=false` and had to be caught and fixed
 * by hand across tickets 6.2/6.10/6.17).
 *
 * A browser test rather than a unit test for the same reason as e2e/admin-runs.spec.ts: the
 * toggle is a Client Component nested inside a Server Component page, and the two only meet in a
 * rendered page. PATCH /api/admin/customers/{id} is stubbed in e2e/fixtures/stub-backend.mjs,
 * which mutates its shared fixture object in place — this file restores it to the fixture's
 * original `is_test: true` at the end of each test that changes it, since the stub-backend
 * process (and its in-memory state) is shared across every spec file and project in this suite.
 *
 * Skipped against a live base URL, same reasoning as admin-runs.spec.ts: asserts on stub-backend
 * fixture data, not whatever a real customer 42 happens to be.
 */
test.use({ httpCredentials: { username: E2E_ADMIN_USER, password: E2E_ADMIN_PASS } });

test.skip(!!process.env.E2E_BASE_URL, "asserts on stub-backend fixtures, not live data");

test("is_test toggle flips a real account to test and back, no page reload needed", async ({
  page,
}) => {
  await page.goto("/admin/customers/42");

  const toggle = page.getByRole("switch");
  // Fixture default (see stub-backend.mjs's ADMIN_CUSTOMER_DETAIL) is is_test: true.
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(toggle).toHaveText(/test account/);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(toggle).toHaveText(/real account/);

  // Restore the shared fixture's state for every other spec/project hitting the same
  // stub-backend process.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
});

test("is_test toggle is always visible, not just when the account is flagged test", async ({
  page,
}) => {
  await page.goto("/admin/customers/42");

  // Before 6.18 this was a badge that only rendered when is_test was true — "real" needs the
  // same at-a-glance state, so the control itself is unconditional.
  await expect(page.getByRole("switch")).toBeVisible();
});
