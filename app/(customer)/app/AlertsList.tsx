"use client";

import type { AlertItem } from "@/lib/customerApi";
import { formatDateTimePl } from "@/lib/format";

import { CopyButton } from "./CopyButton";

/** Ticket 5.3's "recent alerts list": review + draft + Copy button + "PILNE" badge on urgent. */
export function AlertsList({
  alerts,
  loading,
  empty,
}: {
  alerts: AlertItem[] | null;
  loading: boolean;
  empty?: string;
}) {
  if (loading) {
    return <p className="text-sm text-ink-soft">Wczytywanie alertów…</p>;
  }

  if (!alerts || alerts.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        {empty ??
          "Nie masz jeszcze żadnych alertów. Gdy pojawi się nowa recenzja, zobaczysz ją tutaj razem z gotową odpowiedzią."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {alerts.map((alert) => (
        <li key={alert.alert_id} className="rounded-xl border border-line bg-cream-2/50 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            {alert.review_rating != null && <span>★ {alert.review_rating}/5</span>}
            <span>{formatDateTimePl(alert.review_date ?? alert.created_at)}</span>
            {alert.is_urgent && (
              // Urgency badge stays red per the ticket, tuned for the light palette: a saturated
              // solid red (previously bg-red-500/90 on black) was tuned down to this soft-bg +
              // dark-red-text pairing so it reads as an alert rather than a jarring block of color
              // sitting on a cream card — same "computed, not assumed" contrast approach as 6.6b/c.
              <span className="rounded-full bg-[#ffe0e0] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#b3261e]">
                PILNE
              </span>
            )}
          </div>

          {alert.review_text && <p className="mt-2 text-sm text-ink-soft">{alert.review_text}</p>}

          <div className="mt-3 rounded-lg border border-line bg-white p-3">
            <p className="whitespace-pre-wrap text-sm text-ink select-all">{alert.response_text}</p>
          </div>

          <div className="mt-3 flex justify-end">
            <CopyButton text={alert.response_text} />
          </div>
        </li>
      ))}
    </ul>
  );
}
