"use client";

import { useState } from "react";

import { readJson, UNEXPECTED_RESPONSE_EN } from "@/lib/readJson";
import type { CustomerDetail } from "@/lib/api";

/**
 * Ticket 6.18 — the admin panel's first write action. Ends the "manual UPDATE over the bastion
 * tunnel" era for the is_test flag: customers 16, 18/19, 20, 25/26 all shipped as `is_test=false`
 * and had to be caught and fixed by hand across tickets 6.2/6.10/6.17, each time via a direct DB
 * write. This is a Client Component (not the surrounding Server Component page) purely because it
 * needs onClick + local state — the same split every other admin mutation in this repo already
 * uses (LeadDetailClient.tsx).
 */
export function IsTestToggle({ customerId, initial }: { customerId: number; initial: boolean }) {
  const [isTest, setIsTest] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !isTest;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_test: next }),
      });
      const updated = await readJson<CustomerDetail>(
        response,
        `Request failed (${response.status})`,
        UNEXPECTED_RESPONSE_EN
      );
      setIsTest(updated.is_test);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={isTest}
        disabled={busy}
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
          isTest
            ? "bg-zinc-200/80 text-zinc-600 hover:bg-zinc-300/80"
            : "bg-emerald-100/80 text-emerald-700 hover:bg-emerald-200/80"
        }`}
      >
        {isTest ? "test account" : "real account"}
        <span aria-hidden="true">{busy ? "…" : isTest ? "→ mark real" : "→ mark test"}</span>
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
