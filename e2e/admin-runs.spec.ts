import { expect, test } from "@playwright/test";

import { E2E_ADMIN_PASS, E2E_ADMIN_USER } from "../playwright.config";

/**
 * SPRINT_06.md ticket 6.4, part D3/D4 — the run-observability UI.
 *
 * A browser test rather than a unit test because these are Server Components: their data fetching,
 * grouping and rendering happen in the Next.js process, and the only place the three meet is a
 * rendered page. Data comes from e2e/fixtures/stub-backend.mjs, which stands in for the admin API.
 *
 * Skipped against a live base URL: the fixtures below describe stub data, and pointing this at
 * production would assert on whatever real runs happen to exist that day.
 */
test.use({ httpCredentials: { username: E2E_ADMIN_USER, password: E2E_ADMIN_PASS } });

test.skip(!!process.env.E2E_BASE_URL, "asserts on stub-backend fixtures, not live data");

test("runs list shows every counter, newest first, and flags the capped run", async ({ page }) => {
  await page.goto("/admin/runs");

  const rows = page.locator('a[href^="/admin/runs/run-"]');
  await expect(rows).toHaveCount(2);

  // Newest first. Asserted on the ids rather than the rendered times, which are formatted in the
  // server's local timezone and would make this test pass or fail depending on where it runs.
  await expect(rows.first()).toHaveAttribute("href", /run-capped/);
  await expect(rows.nth(1)).toHaveAttribute("href", /run-quiet/);

  // skipped > 0 must read as a problem, not as another number in the row.
  await expect(rows.first()).toHaveClass(/bg-red-50/);
  await expect(rows.first().getByText("capped")).toBeVisible();
  await expect(rows.nth(1)).toHaveClass(/hover:bg-white/);
  await expect(rows.nth(1).getByText("ok")).toBeVisible();

  await expect(rows.first()).toContainText("37"); // records fetched across the ladder
});

test("clicking a run opens its per-customer breakdown", async ({ page }) => {
  await page.goto("/admin/runs");
  await page.locator('a[href^="/admin/runs/run-capped"]').click();

  await expect(page).toHaveURL(/\/admin\/runs\/run-capped/);
  await expect(page.getByRole("heading", { name: /Per-customer breakdown/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "owner@example.com" })).toBeVisible();

  // The urgent review, its draft, and the fact that its email went out.
  await expect(page.getByText("PILNE")).toBeVisible();
  await expect(page.getByText("Zimna zupa i długie czekanie.")).toBeVisible();
  await expect(page.getByText("Bardzo nam przykro.")).toBeVisible();

  // The deferred one is called out as awaiting the sweep rather than silently lacking a timestamp.
  await expect(page.getByText("Not emailed — awaiting sweep")).toBeVisible();
});

test("customer alert history groups under run headers and falls back to the date when run_id is null", async ({
  page,
}) => {
  await page.goto("/admin/customers/42");

  // Attributed row: grouped under a header that links to the run.
  const runHeader = page.getByRole("link", { name: /^Run run-capp/ });
  await expect(runHeader).toBeVisible();
  await expect(runHeader).toHaveAttribute("href", "/admin/runs/run-capped-0000000000000000");

  // Historical row (run_id null, written before migration 010): grouped by its own date instead,
  // so it is neither hidden nor filed under an invented run.
  await expect(page.getByText("20 Jul 2026", { exact: true })).toBeVisible();
  await expect(page.getByText("Stara recenzja sprzed migracji 010.")).toBeVisible();
});
