import { defineConfig, devices } from "@playwright/test";

const PORT = 3399;

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
    baseURL: `http://127.0.0.1:${PORT}`,
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
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
