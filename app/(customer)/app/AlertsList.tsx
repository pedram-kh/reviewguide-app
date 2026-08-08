"use client";

import { useState } from "react";

import type { AlertItem } from "@/lib/customerApi";
import { formatDateTimePl } from "@/lib/format";

const COPY_FEEDBACK_MS = 2000;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard permission denied or unavailable (rare, but not worth surfacing as an error —
      // the text is already selectable/visible for a manual copy).
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white transition-colors hover:border-white/30"
    >
      {copied ? "Skopiowano ✓" : "Kopiuj"}
    </button>
  );
}

/** Ticket 5.3's "recent alerts list": review + draft + Copy button + "PILNE" badge on urgent. */
export function AlertsList({ alerts, loading }: { alerts: AlertItem[] | null; loading: boolean }) {
  if (loading) {
    return <p className="text-sm text-white/50">Wczytywanie alertów…</p>;
  }

  if (!alerts || alerts.length === 0) {
    return (
      <p className="text-sm text-white/50">
        Nie masz jeszcze żadnych alertów. Gdy pojawi się nowa recenzja, zobaczysz ją tutaj razem z
        gotową odpowiedzią.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {alerts.map((alert) => (
        <li
          key={alert.alert_id}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
            {alert.review_rating != null && <span>★ {alert.review_rating}/5</span>}
            <span>{formatDateTimePl(alert.review_date ?? alert.created_at)}</span>
            {alert.is_urgent && (
              <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">
                PILNE
              </span>
            )}
          </div>

          {alert.review_text && (
            <p className="mt-2 text-sm text-white/70">{alert.review_text}</p>
          )}

          <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
            <p className="whitespace-pre-wrap text-sm text-white select-all">{alert.response_text}</p>
          </div>

          <div className="mt-3 flex justify-end">
            <CopyButton text={alert.response_text} />
          </div>
        </li>
      ))}
    </ul>
  );
}
