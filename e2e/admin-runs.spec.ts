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

  // The urgent review, its draft, and the fact that its email went out. Exact match: the group
  // header's own urgency-count summary also contains the substring "PILNE".
  await expect(page.getByText("PILNE", { exact: true })).toBeVisible();
  await expect(page.getByText("Zimna zupa i długie czekanie.")).toBeVisible();
  await expect(page.getByText("Bardzo nam przykro.")).toBeVisible();

  // The deferred one is called out as awaiting the sweep rather than silently lacking a timestamp.
  await expect(page.getByText("Not emailed — awaiting sweep")).toBeVisible();
});

test("customer alert history groups under run headers and falls back to the date when run_id is null", async ({
  page,
}) => {
  await page.goto("/admin/customers/42");

  // Attributed row: grouped under a header that links to the run. Newest group, so expanded by
  // default — its content is visible with no click required.
  const runHeader = page.getByRole("link", { name: /^Run run-capp/ });
  await expect(runHeader).toBeVisible();
  await expect(runHeader).toHaveAttribute("href", "/admin/runs/run-capped-0000000000000000");
  await expect(page.getByText("Zimna zupa i długie czekanie.")).toBeVisible();

  // Historical row (run_id null, written before migration 010): grouped by its own date instead,
  // so it is neither hidden nor filed under an invented run — but it is the older group, so it
  // starts collapsed. `data-accordion-state` is asserted rather than the content's own visibility:
  // Playwright's visibility check looks at an element's own box, not whether a *clipping ancestor*
  // (this group's collapsed, zero-height, overflow-hidden body) hides it — the text is still
  // "visible" by that narrower definition even though no human sees it on screen.
  const dateGroup = page.locator("[data-accordion-state]").filter({ hasText: "20 Jul 2026" });
  await expect(dateGroup).toHaveAttribute("data-accordion-state", "closed");

  // Expanding it (via its chevron) reveals the content — pure presentation, no data change.
  // force: true — mobile-chromium's tap emulation combined with the chevron's max-height CSS
  // transition on the group ABOVE this one makes Playwright's own actionability/stability wait
  // flake on this click (confirmed by screenshot: the button is not actually obstructed). The
  // toggle itself is a plain button with no side effects worth an extra actionability check here.
  await dateGroup.getByRole("button", { name: "Expand group" }).click({ force: true });
  await expect(dateGroup).toHaveAttribute("data-accordion-state", "open");
  await expect(dateGroup.getByText("Stara recenzja sprzed migracji 010.")).toBeVisible();
});

test("alert-history and run-breakdown groups collapse and re-expand without losing their content", async ({
  page,
}) => {
  await page.goto("/admin/runs/run-capped-0000000000000000");

  // Single customer in this run's fixture, so it is the newest/only group and starts expanded.
  const group = page.locator("[data-accordion-state]").filter({ hasText: "owner@example.com" });
  await expect(group).toHaveAttribute("data-accordion-state", "open");
  const urgentText = group.getByText("Zimna zupa i długie czekanie.");
  await expect(urgentText).toBeVisible();

  // force: true — see the same note in the customer-detail test above.
  await group.getByRole("button", { name: "Collapse group" }).click({ force: true });
  await expect(group).toHaveAttribute("data-accordion-state", "closed");

  await group.getByRole("button", { name: "Expand group" }).click({ force: true });
  await expect(group).toHaveAttribute("data-accordion-state", "open");
  await expect(urgentText).toBeVisible();
});
