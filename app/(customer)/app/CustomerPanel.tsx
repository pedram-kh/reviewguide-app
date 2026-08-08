"use client";

import { useEffect, useState } from "react";

import type { AlertItem, ConnectPlaceResult, CustomerState } from "@/lib/customerApi";
import { formatDateTimePl } from "@/lib/format";
import { DARK_GLASS_CARD } from "@/lib/theme";

import { AlertsList } from "./AlertsList";
import { ConnectRestaurantFlow } from "./ConnectRestaurantFlow";
import { SettingsForm } from "./SettingsForm";

/**
 * Ticket 5.3's customer panel: renders the connect-restaurant flow when no place is connected
 * yet, or the post-connect home (restaurant card, last-checked time, alerts, settings, billing
 * link) once one is. `initialState` comes from the server component's own fetch (no loading
 * flash on first paint); everything after that is client-side, same pattern as
 * app/admin/leads/[id]/LeadDetailClient.tsx.
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

  useEffect(() => {
    if (!state.place) return;
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
  }, [state.place]);

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
      {justConnected && (
        <div className={`${DARK_GLASS_CARD} p-5`}>
          <p className="text-sm font-semibold text-white">Restauracja połączona!</p>
          <p className="mt-1 text-sm text-white/60">
            {justConnected.day_one.digest_sent
              ? `Wysłaliśmy e-mail z ${justConnected.day_one.drafts_generated} gotowymi odpowiedziami na najnowsze recenzje.`
              : justConnected.day_one.drafts_generated > 0
                ? `Przygotowaliśmy ${justConnected.day_one.drafts_generated} odpowiedzi — zobaczysz je poniżej.`
                : "Sprawdziliśmy najnowsze recenzje — nowe odpowiedzi pojawią się poniżej, gdy tylko będą gotowe."}
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
