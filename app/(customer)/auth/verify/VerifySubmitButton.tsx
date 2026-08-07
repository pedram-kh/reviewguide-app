"use client";

import { useState } from "react";

/**
 * Disables itself on submit (SPRINT_04.md ticket 4.5 — a real Stakeholder walkthrough double-
 * submitted this exact form: two POSTs 4.7s apart, same token, first 200 then a correctly-rejected
 * 401 the human read as "the link is broken" rather than "you already used it a moment ago". The
 * backend's single-use enforcement was never wrong; nothing here stopped an impatient second click
 * before the first request's page navigation visibly completed. Still a plain `<form method="post">`
 * navigating to `/api/auth/complete-verify` (ticket 4.2b's explicit, deliberate choice, so the
 * consuming endpoint stays a directly-curlable route) — this only adds a client-side guard against
 * the one realistic way a human fires it twice.
 */
export function VerifySubmitButton() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <button
      type="submit"
      disabled={submitting}
      onClick={() => setSubmitting(true)}
      className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {submitting ? "Logowanie…" : "Zaloguj się do ReviewGuide"}
    </button>
  );
}
