"use client";

import { useRef } from "react";

/**
 * The interstitial's token-consuming form (SPRINT_04.md tickets 4.2b + 4.5).
 *
 * Still a plain `<form method="POST">` navigating to /api/auth/complete-verify — ticket 4.2b's
 * deliberate choice, so the consuming endpoint stays a directly-curlable route rather than a
 * Server Action. The only thing this client component adds is double-submit protection.
 *
 * Two findings from ticket 4.5's Stakeholder walkthrough shaped this, and both are worth keeping
 * in mind before "improving" it:
 *
 * Finding 2 — an impatient double-click fired two POSTs; the first consumed the single-use token
 * and the second returned a correct-but-baffling 401. Hence the guard.
 *
 * Finding 3 — the first attempt at that guard disabled the submit button inside its own onClick.
 * A disabled submit control cannot activate form submission, and onClick runs *before* the
 * browser's submission algorithm, so the guard silently cancelled the very submission it was
 * protecting: no request ever left the browser (App Runner logged zero POSTs and the token's
 * `used_at` stayed NULL) while the UI sat on "Logowanie…" forever.
 *
 * So the guard lives in the form's onSubmit — where submission is already committed — and is a
 * plain synchronous ref latch, immune to render timing. The first submit passes through
 * completely untouched; only repeats are preventDefault()ed.
 *
 * There is deliberately no "Logowanie…" pending state. It cannot work: once a native form POST
 * begins, the browser suspends the page, so a React re-render never paints (verified in
 * e2e/verify-interstitial.spec.ts — the state-based version failed on both mobile and desktop).
 * The only reason the Stakeholder ever saw that label was that the broken guard had cancelled the
 * navigation, leaving the page running. A pending label here would be visible only when the flow
 * is broken, which is precisely backwards. Users get the browser's own native loading indicator
 * instead, and a stray second click is now harmless rather than confusing.
 */
export function VerifyForm({ token }: { token: string }) {
  const submittedRef = useRef(false);

  return (
    <form
      action="/api/auth/complete-verify"
      method="POST"
      className="mt-6"
      onSubmit={(event) => {
        if (submittedRef.current) {
          event.preventDefault();
          return;
        }
        submittedRef.current = true;
      }}
    >
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
      >
        Zaloguj się do ReviewGuide
      </button>
    </form>
  );
}
