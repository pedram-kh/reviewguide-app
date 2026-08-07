"use client";

import { useState, type FormEvent } from "react";

import { DARK_GLASS_CARD } from "@/lib/theme";

interface EmailAuthFormProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  errorMessage?: string;
}

/**
 * The email-only form shared by /signup and /login (SPRINT_04.md ticket 4.2 — both pages funnel
 * into the same POST /api/auth/request-link call; passwordless auth doesn't distinguish
 * "signing up" from "logging in" until the link is clicked). On success, swaps in the "sprawdź
 * skrzynkę" confirmation state in place rather than navigating anywhere — there's no page to go
 * to until the emailed link is clicked.
 */
export function EmailAuthForm({ title, subtitle, submitLabel, errorMessage }: EmailAuthFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    try {
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
      </form>
    </div>
  );
}
