import { expect, test } from "@playwright/test";

/**
 * Live end-to-end check of the real magic-link login against the deployed site, used to confirm
 * ticket 4.5's finding-3 fix before asking the Stakeholder to retry. Unlike the stubbed specs in
 * verify-interstitial.spec.ts this consumes a genuine single-use token and hits the real backend,
 * so it is opt-in and only runs when handed a freshly seeded one:
 *
 *   E2E_BASE_URL=https://app.reviewguide.eu LIVE_TOKEN=<raw-token> npx playwright test live-login
 *
 * The token is single-use, so this passes exactly once per seeded token — a rerun is expected to
 * fail on the (correct) already-consumed path.
 *
 * Also asserts the session cookie's attributes, since the flow crosses a Netlify route handler
 * and a bad SameSite/Secure combination would drop the cookie on mobile Safari specifically.
 */
const LIVE_TOKEN = process.env.LIVE_TOKEN;

test.skip(!LIVE_TOKEN, "set LIVE_TOKEN (and E2E_BASE_URL) to run the live login check");

test("real magic-link token logs in and sets a usable session cookie", async ({ page }) => {
  await page.goto(`/auth/verify?token=${LIVE_TOKEN}`);
  await expect(page.getByRole("button", { name: /Zaloguj się do ReviewGuide/ })).toBeVisible();

  await page.getByRole("button", { name: /Zaloguj się do ReviewGuide/ }).click();
  await page.waitForURL(/\/app/, { timeout: 20_000 });

  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name.includes("session"));
  expect(session, `no session cookie; got ${cookies.map((c) => c.name).join(", ")}`).toBeTruthy();
  expect(session!.httpOnly).toBe(true);
  expect(session!.secure).toBe(true);
  expect(["Lax", "Strict"]).toContain(session!.sameSite);

  // Reload to prove the cookie is actually accepted and replayed, not just present in-memory.
  await page.reload();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.locator("body")).not.toContainText("Zaloguj się");
});
