"use client";

import { useEffect, useState } from "react";

import type { AlertItem, ConnectPlaceResult, CustomerState } from "@/lib/customerApi";
import { formatDateTimePl } from "@/lib/format";
import { DARK_GLASS_CARD } from "@/lib/theme";

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
        const data = await response.json();
        if (!cancelled) setAlerts(data.alerts as AlertItem[]);
      } catch {
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
        if (!response.ok) return;
        const data = (await response.json()) as CustomerState;
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
      const data = await response.json();
      if (response.ok) setState(data as CustomerState);
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
        <div className={`${DARK_GLASS_CARD} p-5`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-300"
              aria-hidden="true"
            />
            Restauracja połączona — przygotowujemy odpowiedzi
          </p>
          <p className="mt-1 text-sm text-white/60">
            Pobieramy najnowsze opinie i piszemy do nich odpowiedzi. Zwykle zajmuje to około minuty.
            Możesz zamknąć tę stronę — wyślemy e-mail, gdy będą gotowe.
          </p>
        </div>
      )}

      {/* A finished run reports what it actually did. `justConnected` gates this so it shows after a
          connect in this session, not on every later visit — but the numbers come from the run's own
          persisted summary, not from the connect response, which no longer carries them. */}
      {justConnected && dayOneStatus === "done" && state.day_one.summary && (
        <div className={`${DARK_GLASS_CARD} p-5`}>
          <p className="text-sm font-semibold text-white">Odpowiedzi gotowe!</p>
          <p className="mt-1 text-sm text-white/60">
            {state.day_one.summary.digest_sent
              ? `Wysłaliśmy e-mail z ${state.day_one.summary.drafts_generated} gotowymi odpowiedziami na najnowsze recenzje.`
              : state.day_one.summary.drafts_generated > 0
                ? `Przygotowaliśmy ${state.day_one.summary.drafts_generated} odpowiedzi — zobaczysz je poniżej.`
                : "Sprawdziliśmy najnowsze opinie — nie było jeszcze nic nowego do odpowiedzi. Damy znać, gdy pojawi się kolejna."}
          </p>
          <button
            type="button"
            onClick={() => setJustConnected(null)}
            className="mt-3 text-xs text-white/50 underline underline-offset-2 hover:text-white/70"
          >
            Zamknij
          </button>
        </div>
      )}

      {/* Told, not hidden: the restaurant IS connected either way, and the 2h poller will pick up
          new opinions regardless — but the day-one drafts specifically did not get made, so
          promising them would be a lie and saying nothing would look like they never existed. */}
      {(dayOneStatus === "failed" || dayOneStatus === "stale") && (
        <div className={`${DARK_GLASS_CARD} p-5`}>
          <p className="text-sm font-semibold text-white">Restauracja połączona</p>
          <p className="mt-1 text-sm text-white/60">
            Nie udało nam się przygotować pierwszych odpowiedzi. Restauracja jest połączona i
            sprawdzamy ją dalej — kolejne opinie trafią do Ciebie normalnie. Jeśli chcesz odzyskać
            pierwsze odpowiedzi, napisz do nas.
          </p>
        </div>
      )}

      <div className={`${DARK_GLASS_CARD} p-6`}>
        <p className="text-sm text-white/60">Połączona restauracja</p>
        <p className="mt-1 text-lg font-semibold text-white">{state.place.name ?? "Bez nazwy"}</p>
        {state.place.address && <p className="mt-1 text-sm text-white/60">{state.place.address}</p>}
        {state.place.rating != null && (
          <p className="mt-1 text-sm text-white/60">★ {state.place.rating.toFixed(1)}</p>
        )}
        <p className="mt-3 text-xs text-white/40">
          Ostatnio sprawdzono:{" "}
          {state.place.last_polled_at ? formatDateTimePl(state.place.last_polled_at) : "jeszcze nie sprawdzono"}
        </p>
      </div>

      <div className={`${DARK_GLASS_CARD} p-6`}>
        <p className="mb-4 text-sm font-semibold text-white">Ostatnie alerty</p>
        <AlertsList alerts={alerts} loading={alertsLoading} />
      </div>

      <div className={`${DARK_GLASS_CARD} p-6`}>
        <p className="mb-4 text-sm font-semibold text-white">Ustawienia</p>
        <SettingsForm state={state} onSaved={setState} />

        {isSubscribed && (
          <form action="/api/billing/portal" method="post" className="mt-5 border-t border-white/10 pt-4">
            <button type="submit" className="text-xs text-white/50 underline underline-offset-2 hover:text-white/70">
              Zarządzaj subskrypcją
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
