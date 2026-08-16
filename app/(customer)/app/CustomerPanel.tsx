"use client";

import { useEffect, useState } from "react";

import type { AlertItem, ConnectPlaceResult, CustomerState } from "@/lib/customerApi";
import { formatDateTimePl } from "@/lib/format";
import { readJson } from "@/lib/readJson";
import { CUSTOMER_CARD } from "@/lib/theme";

import { AlertsList } from "./AlertsList";
import { ConnectRestaurantFlow } from "./ConnectRestaurantFlow";
import { SettingsForm } from "./SettingsForm";

// Ticket 6.1: how often the panel re-reads GET /api/customer/state while day-one is in flight. The
// job takes ~58s for a brand-new place (Outscraper + ten sequential Claude calls), so this is ~20
// cheap DB-only reads over the life of a run — frequent enough that the card updates promptly,
// nowhere near often enough to matter for a single connecting customer.
const DAY_ONE_POLL_MS = 3000;

/**
 * Ticket 5.3's customer panel: renders the connect-restaurant flow when no place is connected
 * yet, or the post-connect home (restaurant card, last-checked time, alerts, settings, billing
 * link) once one is. `initialState` comes from the server component's own fetch (no loading
 * flash on first paint); everything after that is client-side, same pattern as
 * app/admin/leads/[id]/LeadDetailClient.tsx.
 *
 * Ticket 6.1 adds the day-one progress state. Because connect-place answers 202 before the drafts
 * exist, "connected" and "your drafts are ready" are now two different moments, and the panel has
 * to show both honestly instead of implying the second the instant the first happens. The polling
 * also covers the case that originally surfaced the bug: a customer who reloads mid-run gets the
 * progress card from the server-rendered state, not an empty-looking panel.
 */
export function CustomerPanel({
  initialState,
  isSubscribed,
}: {
  initialState: CustomerState;
  isSubscribed: boolean;
}) {
  const [state, setState] = useState(initialState);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [justConnected, setJustConnected] = useState<ConnectPlaceResult | null>(null);

  const dayOneStatus = state.day_one.status;
  const dayOneRunning = dayOneStatus === "running";

  // Keyed on the status rather than the whole day_one object so the alerts reload fires when a run
  // finishes (running -> done), which is the moment the drafts it generated become readable.
  useEffect(() => {
    if (!state.place) return;
    if (dayOneRunning) return;
    let cancelled = false;

    async function loadAlerts() {
      setAlertsLoading(true);
      try {
        const response = await fetch("/api/customer/alerts");
        const data = await readJson<{ alerts: AlertItem[] }>(response, "Nie udało się wczytać alertów.");
        if (!cancelled) setAlerts(data.alerts);
      } catch {
        // Empty rather than an error banner: the alerts list has its own "no alerts yet" empty state,
        // and a failed load looks the same to a customer who genuinely has none. Reaching this branch
        // on a failed *request* is new — the old code read the body without checking the status, so a
        // 5xx set `alerts` to `undefined` and rendered as though the list had loaded successfully.
        if (!cancelled) setAlerts([]);
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    }

    loadAlerts();
    return () => {
      cancelled = true;
    };
  }, [state.place, dayOneRunning]);

  // Poll only while a run is actually in flight. `stale` deliberately does NOT keep polling: it
  // means the run started but never recorded a finish (an App Runner restart mid-run), so no
  // process is still working and there is nothing left to wait for.
  useEffect(() => {
    if (!dayOneRunning) return;
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/customer/state");
        const data = await readJson<CustomerState>(response, "Nie udało się odczytać stanu.");
        if (!cancelled) setState(data);
      } catch {
        // A dropped poll is not worth surfacing — the next tick retries, and the customer already
        // has an accurate "in progress" card on screen either way.
      }
    }, DAY_ONE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [dayOneRunning]);

  async function handleConnected(result: ConnectPlaceResult) {
    setJustConnected(result);
    try {
      const response = await fetch("/api/customer/state");
      setState(await readJson<CustomerState>(response, "Nie udało się odczytać stanu."));
    } catch {
      // The connect itself already succeeded (result is proof) — a failed state refetch just
      // means the page shows stale data until reload, not a lost connection.
    }
  }

  if (!state.place) {
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <ConnectRestaurantFlow onConnected={handleConnected} />
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      {dayOneRunning && (
        <div className={`${CUSTOMER_CARD} p-5`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold-deep"
              aria-hidden="true"
            />
            Restauracja połączona — przygotowujemy odpowiedzi
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Pobieramy najnowsze opinie i piszemy do nich odpowiedzi. Zwykle zajmuje to około minuty.
            Możesz zamknąć tę stronę — wyślemy e-mail, gdy będą gotowe.
          </p>
        </div>
      )}

      {/* A finished run reports what it actually did. `justConnected` gates this so it shows after a
          connect in this session, not on every later visit — but the numbers come from the run's own
          persisted summary, not from the connect response, which no longer carries them. */}
      {justConnected && dayOneStatus === "done" && state.day_one.summary && (
        <div className={`${CUSTOMER_CARD} p-5`}>
          <p className="text-sm font-semibold text-ink">Odpowiedzi gotowe!</p>
          <p className="mt-1 text-sm text-ink-soft">
            {state.day_one.summary.digest_sent
              ? `Wysłaliśmy e-mail z ${state.day_one.summary.drafts_generated} gotowymi odpowiedziami na najnowsze recenzje.`
              : state.day_one.summary.drafts_generated > 0
                ? `Przygotowaliśmy ${state.day_one.summary.drafts_generated} odpowiedzi — zobaczysz je poniżej.`
                : "Sprawdziliśmy najnowsze opinie — nie było jeszcze nic nowego do odpowiedzi. Damy znać, gdy pojawi się kolejna."}
          </p>
          <button
            type="button"
            onClick={() => setJustConnected(null)}
            className="mt-3 text-xs text-ink-soft underline underline-offset-2 hover:text-ink-soft"
          >
            Zamknij
          </button>
        </div>
      )}

      {/* Told, not hidden: the restaurant IS connected either way, and the 2h poller will pick up
          new opinions regardless — but the day-one drafts specifically did not get made, so
          promising them would be a lie and saying nothing would look like they never existed. */}
      {(dayOneStatus === "failed" || dayOneStatus === "stale") && (
        <div className={`${CUSTOMER_CARD} p-5`}>
          <p className="text-sm font-semibold text-ink">Restauracja połączona</p>
          <p className="mt-1 text-sm text-ink-soft">
            Nie udało nam się przygotować pierwszych odpowiedzi. Restauracja jest połączona i
            sprawdzamy ją dalej — kolejne opinie trafią do Ciebie normalnie. Jeśli chcesz odzyskać
            pierwsze odpowiedzi, napisz do nas.
          </p>
        </div>
      )}

      <div className={`${CUSTOMER_CARD} p-6`}>
        <p className="text-sm text-ink-soft">Połączona restauracja</p>
        <p className="mt-1 text-lg font-semibold text-ink">{state.place.name ?? "Bez nazwy"}</p>
        {state.place.address && <p className="mt-1 text-sm text-ink-soft">{state.place.address}</p>}
        {state.place.rating != null && (
          <p className="mt-1 text-sm text-ink-soft">★ {state.place.rating.toFixed(1)}</p>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          Ostatnio sprawdzono:{" "}
          {state.place.last_polled_at ? formatDateTimePl(state.place.last_polled_at) : "jeszcze nie sprawdzono"}
        </p>
      </div>

      <div className={`${CUSTOMER_CARD} p-6`}>
        <p className="mb-4 text-sm font-semibold text-ink">Ostatnie alerty</p>
        <AlertsList alerts={alerts} loading={alertsLoading} />
      </div>

      <div className={`${CUSTOMER_CARD} p-6`}>
        <p className="mb-4 text-sm font-semibold text-ink">Ustawienia</p>
        <SettingsForm state={state} onSaved={setState} />

        {isSubscribed && (
          <form action="/api/billing/portal" method="post" className="mt-5 border-t border-line pt-4">
            <button type="submit" className="text-xs text-ink-soft underline underline-offset-2 hover:text-ink-soft">
              Zarządzaj subskrypcją
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
