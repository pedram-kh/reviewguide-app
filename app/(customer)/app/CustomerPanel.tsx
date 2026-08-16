"use client";

import { useEffect, useState } from "react";

import { groupAlertsByWarsawDay, latestDayAlerts, urgentCountLast7Days } from "@/lib/alertGroups";
import type { AlertItem, ConnectPlaceResult, CustomerState } from "@/lib/customerApi";
import { formatDateTimePl } from "@/lib/format";
import { parsePanelTab, type PanelTab } from "@/lib/panelTabs";
import { readJson } from "@/lib/readJson";
import { CUSTOMER_CARD } from "@/lib/theme";

import { AlertsList } from "./AlertsList";
import { ConnectRestaurantFlow } from "./ConnectRestaurantFlow";
import { HistoryTable } from "./HistoryTable";
import { SettingsForm } from "./SettingsForm";

const DAY_ONE_POLL_MS = 3000;

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  trialing: { label: "Okres próbny", className: "status-chip status-chip-trial" },
  active: { label: "Aktywna", className: "status-chip status-chip-active" },
  past_due: { label: "Zaległa płatność", className: "status-chip status-chip-warn" },
  canceled: { label: "Anulowana", className: "status-chip status-chip-muted" },
  unpaid: { label: "Nieopłacona", className: "status-chip status-chip-warn" },
  incomplete: { label: "Niedokończona", className: "status-chip status-chip-muted" },
  incomplete_expired: { label: "Wygasła", className: "status-chip status-chip-muted" },
  paused: { label: "Wstrzymana", className: "status-chip status-chip-muted" },
  none: { label: "Brak subskrypcji", className: "status-chip status-chip-muted" },
};

const TAB_LABELS: Record<PanelTab, string> = {
  najnowsze: "Najnowsze",
  historia: "Historia",
  ustawienia: "Ustawienia",
};

/**
 * Ticket 5.3's customer panel, restructured in ticket 6.9: the restaurant card is the hero,
 * alerts/settings live in URL-synced tabs, and the old "Zalogowano jako" card's data moved to
 * the header menu + a status chip on this hero. `initialState` still comes from the server
 * component's own fetch (no loading flash on first paint).
 *
 * Ticket 6.1's day-one progress state is unchanged: connect-place answers 202 before the drafts
 * exist, so "connected" and "your drafts are ready" stay two different moments.
 */
export function CustomerPanel({
  initialState,
  isSubscribed,
  subscriptionStatus,
  initialTab,
}: {
  initialState: CustomerState;
  isSubscribed: boolean;
  subscriptionStatus: string;
  initialTab: PanelTab;
}) {
  const [state, setState] = useState(initialState);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [justConnected, setJustConnected] = useState<ConnectPlaceResult | null>(null);
  const [tab, setTab] = useState<PanelTab>(initialTab);

  const dayOneStatus = state.day_one.status;
  const dayOneRunning = dayOneStatus === "running";

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

  useEffect(() => {
    if (!dayOneRunning) return;
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/customer/state");
        const data = await readJson<CustomerState>(response, "Nie udało się odczytać stanu.");
        if (!cancelled) setState(data);
      } catch {
        // A dropped poll is not worth surfacing — the next tick retries.
      }
    }, DAY_ONE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [dayOneRunning]);

  useEffect(() => {
    function onPop() {
      setTab(parsePanelTab(new URLSearchParams(window.location.search).get("tab")));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function selectTab(next: PanelTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "najnowsze") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.pushState(null, "", url);
  }

  async function handleConnected(result: ConnectPlaceResult) {
    setJustConnected(result);
    try {
      const response = await fetch("/api/customer/state");
      setState(await readJson<CustomerState>(response, "Nie udało się odczytać stanu."));
    } catch {
      // The connect itself already succeeded — a failed state refetch just means stale data until reload.
    }
  }

  if (!state.place) {
    return (
      <div className="flex w-full max-w-2xl flex-col items-center gap-6">
        {tab === "ustawienia" ? (
          <SettingsCard
            state={state}
            onSaved={setState}
            isSubscribed={isSubscribed}
            onBack={() => selectTab("najnowsze")}
          />
        ) : (
          <ConnectRestaurantFlow onConnected={handleConnected} />
        )}
      </div>
    );
  }

  const groups = groupAlertsByWarsawDay(alerts ?? []);
  const najnowsze = latestDayAlerts(alerts ?? []);
  const recentUrgent = urgentCountLast7Days(alerts ?? []);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      {dayOneRunning && (
        <div className={`${CUSTOMER_CARD} p-5`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold-deep" aria-hidden="true" />
            Restauracja połączona — przygotowujemy odpowiedzi
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Pobieramy najnowsze opinie i piszemy do nich odpowiedzi. Zwykle zajmuje to około minuty.
            Możesz zamknąć tę stronę — wyślemy e-mail, gdy będą gotowe.
          </p>
        </div>
      )}

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
            className="mt-3 text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            Zamknij
          </button>
        </div>
      )}

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

      <RestaurantHero
        name={state.place.name ?? "Bez nazwy"}
        address={state.place.address}
        rating={state.place.rating}
        lastPolledAt={state.place.last_polled_at}
        subscriptionStatus={subscriptionStatus}
        isSubscribed={isSubscribed}
        onStartTrial={() => selectTab("ustawienia")}
      />

      <div>
        <div className="panel-tabs" role="tablist" aria-label="Panel restauracji">
          {(Object.keys(TAB_LABELS) as PanelTab[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`panel-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-tabpanel-${id}`}
              className="panel-tab"
              onClick={() => selectTab(id)}
            >
              {TAB_LABELS[id]}
              {id === "historia" && recentUrgent > 0 && (
                <span className="panel-tab-chip" aria-label={`${recentUrgent} pilnych z ostatnich 7 dni`}>
                  {recentUrgent}
                </span>
              )}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`panel-tabpanel-${tab}`}
          aria-labelledby={`panel-tab-${tab}`}
          className="mt-5"
        >
          {tab === "najnowsze" && (
            <AlertsList
              alerts={alerts === null ? null : najnowsze}
              loading={alertsLoading}
            />
          )}
          {tab === "historia" &&
            (alertsLoading ? (
              <p className="text-sm text-ink-soft">Wczytywanie alertów…</p>
            ) : (
              <div className={`${CUSTOMER_CARD} p-2 sm:p-4`}>
                <HistoryTable groups={groups} />
              </div>
            ))}
          {tab === "ustawienia" && (
            <SettingsCard state={state} onSaved={setState} isSubscribed={isSubscribed} />
          )}
        </div>
      </div>
    </div>
  );
}

function RestaurantHero({
  name,
  address,
  rating,
  lastPolledAt,
  subscriptionStatus,
  isSubscribed,
  onStartTrial,
}: {
  name: string;
  address: string | null;
  rating: number | null;
  lastPolledAt: string | null;
  subscriptionStatus: string;
  isSubscribed: boolean;
  onStartTrial: () => void;
}) {
  const chip = STATUS_CHIP[subscriptionStatus] ?? {
    label: subscriptionStatus,
    className: "status-chip status-chip-muted",
  };

  return (
    <div className={`${CUSTOMER_CARD} restaurant-hero p-6 sm:p-8`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{name}</h1>
          {address && <p className="mt-1.5 text-sm text-ink-soft">{address}</p>}
          {rating != null && (
            <p className="mt-2 text-sm font-semibold text-gold-ink">★ {rating.toFixed(1)}</p>
          )}
        </div>
        <span className={chip.className}>{chip.label}</span>
      </div>

      <p className="mt-5 flex items-center gap-2 text-sm text-ink-soft">
        <span className="pulse-dot" aria-hidden="true" />
        <span>
          monitoring aktywny · ostatnie sprawdzenie:{" "}
          <time dateTime={lastPolledAt ?? undefined}>
            {lastPolledAt ? formatDateTimePl(lastPolledAt) : "jeszcze nie sprawdzono"}
          </time>
        </span>
      </p>

      {!isSubscribed && (
        <p className="mt-4 text-sm text-ink-soft">
          Subskrypcja nieaktywna.{" "}
          <button type="button" onClick={onStartTrial} className="font-semibold text-gold-ink underline underline-offset-2">
            Rozpocznij okres próbny
          </button>{" "}
          w Ustawieniach.
        </p>
      )}
    </div>
  );
}

function SettingsCard({
  state,
  onSaved,
  isSubscribed,
  onBack,
}: {
  state: CustomerState;
  onSaved: (state: CustomerState) => void;
  isSubscribed: boolean;
  onBack?: () => void;
}) {
  return (
    <div className={`${CUSTOMER_CARD} w-full p-6`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          ← Wróć
        </button>
      )}
      <p className="mb-4 text-sm font-semibold text-ink">Ustawienia</p>
      <SettingsForm state={state} onSaved={onSaved} />

      {isSubscribed ? (
        <form action="/api/billing/portal" method="post" className="mt-5 border-t border-line pt-4">
          <button type="submit" className="text-sm font-semibold text-gold-ink underline underline-offset-2">
            Zarządzaj subskrypcją
          </button>
        </form>
      ) : (
        <form action="/api/billing/checkout" method="post" className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
          <label className="flex items-start gap-2.5 text-left text-sm text-ink-soft">
            <input
              type="checkbox"
              name="immediate_start_consent"
              value="true"
              required
              className="mt-0.5 size-4 shrink-0 rounded border-line accent-[var(--gold-deep)]"
            />
            <span>
              Żądam niezwłocznego rozpoczęcia świadczenia Usługi i przyjmuję do wiadomości, że po
              jej pełnym wykonaniu utracę prawo odstąpienia od Umowy.
            </span>
          </label>
          <button type="submit" className="btn btn-primary w-full">
            Rozpocznij okres próbny
          </button>
        </form>
      )}
    </div>
  );
}
