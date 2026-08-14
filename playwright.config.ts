import { defineConfig, devices } from "@playwright/test";

const PORT = 3399;
const STUB_BACKEND_PORT = 4009;

// Point the suite at the deployed site instead of a local build, e.g.
// `E2E_BASE_URL=https://app.reviewguide.eu npx playwright test`. Used in ticket 4.5 to confirm
// the finding-3 fix on production before asking the Stakeholder to retry.
const LIVE_BASE_URL = process.env.E2E_BASE_URL;

// Shared with e2e/admin-runs.spec.ts, which sends them as HTTP Basic credentials.
export const E2E_ADMIN_USER = "e2e-admin";
export const E2E_ADMIN_PASS = "e2e-admin-pass";

/**
 * Added by SPRINT_04.md ticket 4.5 for one specific regression class: the interstitial login form
 * silently not submitting. That bug was invisible to `tsc`, `eslint`, and every curl-level check
 * this project had — it lived purely in the browser's form-submission algorithm — so catching it
 * needs a real browser.
 *
 * Runs against a production build (`next start`) rather than `next dev`, since the bug was about
 * client-side event/render timing that dev-mode re-renders could mask.
 *
 * Projects: the Stakeholder hit this on a phone, so a mobile device class (touch input, mobile
 * viewport, mobile UA) is the primary target, not an afterthought. WebKit — the actual iOS Safari
 * engine — is deliberately NOT a project here: Playwright's only WebKit build for macOS 14 is the
 * frozen `webkit_mac14_special` one, which crashes on launch (`Bus error: 10`) on this machine.
 * That is disclosed rather than papered over; mobile-chromium covers the device class (touch +
 * viewport + UA) but not the engine, and final iOS confirmation is the Stakeholder's own retry on
 * his real phone. Add a `mobile-webkit` project here the moment WebKit runs on the dev machine or
 * in CI on a newer macOS.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: LIVE_BASE_URL ?? `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: LIVE_BASE_URL
    ? undefined
    : [
        // SPRINT_05.md ticket 5.3's customer-panel.spec.ts needs BACKEND_URL to point somewhere
        // that will actually answer /api/billing/status + /api/customer/state/alerts during
        // /app's server-side render (see e2e/fixtures/stub-backend.mjs's own docstring for why
        // page.route() alone can't cover that call).
        {
          command: `node e2e/fixtures/stub-backend.mjs`,
          port: STUB_BACKEND_PORT,
          reuseExistingServer: !process.env.CI,
          env: { STUB_BACKEND_PORT: String(STUB_BACKEND_PORT) },
        },
        {
          command: `npx next start --port ${PORT}`,
          url: `http://127.0.0.1:${PORT}/login`,
          env: {
            BACKEND_URL: `http://127.0.0.1:${STUB_BACKEND_PORT}`,
            // /admin is behind HTTP Basic Auth and fails closed when these are unset, so ticket
            // 6.4's admin-runs spec cannot reach a single page without them. Local-fixture
            // credentials only — this webServer block never runs against a deployed environment.
            ADMIN_USER: E2E_ADMIN_USER,
            ADMIN_PASS: E2E_ADMIN_PASS,
          },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
