import { expect, test } from "@playwright/test";

const TOKEN = "e2e-test-token-not-a-real-one";
const VERIFY_URL = `/auth/verify?token=${TOKEN}`;

/**
 * Regression tests for SPRINT_04.md ticket 4.5's walkthrough findings 2 and 3.
 *
 * Finding 3 (the reason this file exists): a double-submit guard that disabled the submit button
 * inside its own onClick cancelled the native form submission outright — the button flipped to
 * "Logowanie…" and no request was ever sent (App Runner logs showed zero POSTs; the token's
 * `used_at` stayed NULL). The first test is the one that would have caught it.
 *
 * Finding 2: a real human double-click fired two POSTs, burning the single-use token on the first
 * and surfacing the second's correct-but-confusing 401. The second test asserts exactly one POST.
 *
 * Both stub /api/auth/complete-verify at the network layer, so no backend, no real token and no
 * Postmark send are involved — the interception IS the assertion.
 */
test.describe("verify interstitial form", () => {
  test("clicking the button actually submits a POST carrying the token", async ({ page }) => {
    const posts: { method: string; token: string | null }[] = [];

    await page.route("**/api/auth/complete-verify", async (route) => {
      const request = route.request();
      posts.push({
        method: request.method(),
        token: new URLSearchParams(request.postData() ?? "").get("token"),
      });
      await route.fulfill({ status: 303, headers: { location: "/login?e2e=stubbed" } });
    });

    await page.goto(VERIFY_URL);
    await page.getByRole("button", { name: /Zaloguj się do ReviewGuide/ }).click();

    await expect.poll(() => posts.length, { timeout: 10_000 }).toBe(1);
    expect(posts[0].method).toBe("POST");
    expect(posts[0].token).toBe(TOKEN);
  });

  test("a second click while the first is in flight does not fire a second POST", async ({
    page,
  }) => {
    let postCount = 0;

    // Hold the response open long enough for a second click to be physically possible — the
    // impatient-human scenario from the real walkthrough. Clicks are dispatched from inside the
    // page so Playwright never blocks waiting on the (deliberately stalled) navigation.
    await page.route("**/api/auth/complete-verify", async (route) => {
      postCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      await route.fulfill({ status: 303, headers: { location: "/login?e2e=stubbed" } });
    });

    await page.goto(VERIFY_URL);
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('button[type="submit"]');
      button?.click();
      setTimeout(() => button?.click(), 400);
    });

    await expect.poll(() => postCount, { timeout: 10_000 }).toBe(1);

    // Give the second click time to have (wrongly) produced a POST, then confirm it didn't.
    await page.waitForTimeout(1_500);
    expect(postCount).toBe(1);
  });

  test("the page actually navigates away instead of hanging", async ({ page }) => {
    // The Stakeholder-visible symptom of finding 3 was a page that simply never moved. Asserting
    // the navigation itself catches that regardless of what caused it.
    await page.route("**/api/auth/complete-verify", async (route) => {
      await route.fulfill({ status: 303, headers: { location: "/login?e2e=stubbed" } });
    });

    await page.goto(VERIFY_URL);
    await page.getByRole("button", { name: /Zaloguj się do ReviewGuide/ }).click();

    await page.waitForURL(/\/login\?e2e=stubbed/, { timeout: 10_000 });
    expect(page.url()).toContain("e2e=stubbed");
  });
});
