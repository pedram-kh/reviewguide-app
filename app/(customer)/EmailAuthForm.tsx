"use client";

import { useState, type FormEvent } from "react";

import { DARK_GLASS_CARD } from "@/lib/theme";

interface EmailAuthFormProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  errorMessage?: string;
  // Ticket 6.6, part C. Only /signup passes "signup" — /login's default omits the consent
  // checkboxes entirely, since a returning customer already has consent on record (see
  // app/routers/auth.py's request_link(), which only requires accept_terms when signup=true).
  mode?: "signup" | "login";
}

const LEGAL_BASE_URL = "https://reviewguide.eu";

/**
 * The email-only form shared by /signup and /login (SPRINT_04.md ticket 4.2 — both pages funnel
 * into the same POST /api/auth/request-link call; passwordless auth doesn't distinguish
 * "signing up" from "logging in" until the link is clicked). On success, swaps in the "sprawdź
 * skrzynkę" confirmation state in place rather than navigating anywhere — there's no page to go
 * to until the emailed link is clicked.
 *
 * Ticket 6.6 adds two consent checkboxes when `mode="signup"`: a required Terms+Privacy one
 * (native HTML `required` blocks submission even though this form's onSubmit is JS-driven — the
 * browser runs constraint validation before dispatching the submit event at all) and an optional
 * marketing one. Both are sent to the backend, which persists them (via the auth_tokens ->
 * customers hand-off documented in migration 011's docstring).
 */
export function EmailAuthForm({
  title,
  subtitle,
  submitLabel,
  errorMessage,
  mode = "login",
}: EmailAuthFormProps) {
  const [email, setEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error" | "consent_error">(
    "idle"
  );
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSignup && !acceptTerms) {
      setStatus("consent_error");
      return;
    }
    setStatus("submitting");
    try {
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          ...(isSignup
            ? { signup: true, accept_terms: acceptTerms, marketing_consent: marketingConsent }
            : {}),
        }),
      });
      setStatus(response.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className={`${DARK_GLASS_CARD} mx-auto max-w-md p-8 text-center`}>
        <h1 className="text-2xl font-semibold text-white">Sprawdź skrzynkę</h1>
        <p className="mt-3 text-sm text-white/70">
          Jeśli <span className="text-white">{email}</span> jest prawidłowym adresem, wysłaliśmy na
          niego link logowania. Link jest ważny 15 minut.
        </p>
      </div>
    );
  }

  return (
    <div className={`${DARK_GLASS_CARD} mx-auto max-w-md p-8`}>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className="mt-2 text-sm text-white/70">{subtitle}</p>

      {errorMessage && (
        <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {errorMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <label htmlFor="email" className="sr-only">
          Adres e-mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="ty@restauracja.pl"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 outline-none focus:border-white/40"
        />

        {isSignup && (
          <div className="flex flex-col gap-2.5 pt-1">
            <label className="flex items-start gap-2.5 text-sm text-white/80">
              <input
                type="checkbox"
                required
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-white/30 bg-white/5"
              />
              <span>
                Akceptuję{" "}
                <a
                  href={`${LEGAL_BASE_URL}/regulamin`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  Regulamin
                </a>{" "}
                i{" "}
                <a
                  href={`${LEGAL_BASE_URL}/polityka-prywatnosci`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  Politykę Prywatności
                </a>
                .
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm text-white/60">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(event) => setMarketingConsent(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-white/30 bg-white/5"
              />
              <span>Chcę otrzymywać informacje marketingowe (newsletter) e-mailem.</span>
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "submitting" ? "Wysyłanie…" : submitLabel}
        </button>
        {status === "error" && (
          <p className="text-sm text-red-300">Coś poszło nie tak. Spróbuj ponownie.</p>
        )}
        {status === "consent_error" && (
          <p className="text-sm text-red-300">
            Musisz zaakceptować Regulamin i Politykę Prywatności, aby założyć konto.
          </p>
        )}
      </form>
    </div>
  );
}
