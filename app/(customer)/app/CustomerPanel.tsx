"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
 *
 * Ticket 6.9a (bug 2): the tab is derived from `useSearchParams()` rather than a one-time
 * `initialTab` prop + local `useState`. The prop-based version only read `?tab=` on this
 * component's *first* mount — a `<Link href="/app?tab=ustawienia">` click (the header menu's
 * Ustawienia item) does update the URL and re-renders the server page with a new prop, but
 * `useState(initialTab)`'s initializer is only consulted on mount, so the already-mounted
 * component's tab never moved. `useSearchParams()` is reactive to every URL change the Next.js
 * router makes — Link clicks, `router.push`, and browser back/forward alike (same pattern as
 * `admin/leads/LeadsFilterBar.tsx`) — so `tab` is now single-source-of-truth from the URL, with
 * no separate state to fall out of sync and no manual `popstate` listener needed.
 */
export function CustomerPanel({
  initialState,
  isSubscribed,
  subscriptionStatus,
}: {
  initialState: CustomerState;
  isSubscribed: boolean;
  subscriptionStatus: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parsePanelTab(searchParams.get("tab"));
  const [state, setState] = useState(initialState);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [justConnected, setJustConnected] = useState<ConnectPlaceResult | null>(null);

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

  function selectTab(next: PanelTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "najnowsze") params.delete("tab");
    else params.set("tab", next);
    router.push(params.toString() ? `/app?${params.toString()}` : "/app", { scroll: false });
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
  // Ticket 6.17 (partner feedback 11+12): a connected-but-unsubscribed customer has zero alerts
  // for a structural reason (day-one is gated — see app.jobs.day_one.claim_day_one_start), not
  // because nothing has happened yet. The generic "nie masz jeszcze żadnych alertów" empty state
  // implies the latter and must not render here.
  const inactiveEmptyMessage = isSubscribed ? undefined : "Twoje odpowiedzi pojawią się po aktywacji.";

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
      />

      {/* Ticket 6.17 (partner feedback 11+12): the primary CTA for a connected-but-unsubscribed
          customer is now this card — a real checkout form (consent checkbox included), not a
          link that merely navigates to Ustawienia and makes the customer find the form there
          themselves. Ustawienia's own copy of this form (SettingsCard below) stays as a second,
          equally-valid access point — hidden here only while that tab is already open, so the
          customer is never shown the identical form twice on one screen at once. */}
      {!isSubscribed && tab !== "ustawienia" && <CheckoutActivationCard />}

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
              empty={inactiveEmptyMessage}
            />
          )}
          {tab === "historia" &&
            (alertsLoading ? (
              <p className="text-sm text-ink-soft">Wczytywanie alertów…</p>
            ) : (
              <div className={`${CUSTOMER_CARD} p-2 sm:p-4`}>
                <HistoryTable groups={groups} empty={inactiveEmptyMessage} />
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
}: {
  name: string;
  address: string | null;
  rating: number | null;
  lastPolledAt: string | null;
  subscriptionStatus: string;
  isSubscribed: boolean;
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

      {/* Ticket 6.17 (partner feedback 11+12): this line must never claim active monitoring for
          an account backend/day_one.py's own gate has not actually started polling/day-one for —
          the poller's own ELIGIBLE_STATUSES check (LOGIC.md §8a) means an unsubscribed connected
          place genuinely receives nothing yet, so saying otherwise here would be a second copy of
          the exact bug this ticket fixes on the backend. */}
      {isSubscribed ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-ink-soft">
          <span className="pulse-dot" aria-hidden="true" />
          <span>
            monitoring aktywny · ostatnie sprawdzenie:{" "}
            <time dateTime={lastPolledAt ?? undefined}>
              {lastPolledAt ? formatDateTimePl(lastPolledAt) : "jeszcze nie sprawdzono"}
            </time>
          </span>
        </p>
      ) : (
        <p className="mt-5 flex items-center gap-2 text-sm text-ink-soft">
          <span className="pulse-dot-inactive" aria-hidden="true" />
          <span>monitoring nieaktywny — dodaj kartę, aby rozpocząć</span>
        </p>
      )}
    </div>
  );
}

// Ticket 6.17 (partner feedback 11+12): the exact form CheckoutActivationCard (primary CTA, on
// the main panel) and SettingsCard's Ustawienia copy (secondary access point) both need — same
// endpoint, same consent requirement (ticket 6.6 part C, ToS §8.3's withdrawal-waiver), same
// button text, so the two cannot silently drift into saying different things about the same
// action. `formId` keeps each rendered <input>/<button> pair's ids unique when both could in
// principle be mounted at once (they cannot today — CheckoutActivationCard only renders on the
// connected view, SettingsCard's unsubscribed branch on the Ustawienia tab of that same view —
// but unique ids cost nothing and avoid relying on that not changing).
function CheckoutForm({ formId }: { formId: string }) {
  return (
    <form
      action="/api/billing/checkout"
      method="post"
      className="flex flex-col gap-3"
    >
      <label
        htmlFor={`${formId}-consent`}
        className="flex items-start gap-2.5 text-left text-sm text-ink-soft"
      >
        <input
          id={`${formId}-consent`}
          type="checkbox"
          name="immediate_start_consent"
          value="true"
          required
          className="mt-0.5 size-4 shrink-0 rounded border-line accent-[var(--gold-deep)]"
        />
        <span>
          Żądam niezwłocznego rozpoczęcia świadczenia Usługi i przyjmuję do wiadomości, że po jej
          pełnym wykonaniu utracę prawo odstąpienia od Umowy.
        </span>
      </label>
      <button type="submit" className="btn btn-primary w-full">
        Dodaj kartę, aby rozpocząć
      </button>
    </form>
  );
}

function CheckoutActivationCard() {
  return (
    <div className={`${CUSTOMER_CARD} p-6 sm:p-8`}>
      <p className="text-sm font-semibold text-ink">Aktywuj monitoring</p>
      <p className="mt-1 text-sm text-ink-soft">
        Restauracja jest połączona, ale monitoring i odpowiedzi na recenzje ruszą po dodaniu
        karty — 14 dni okresu próbnego, zero dodatkowych kroków później.
      </p>
      <div className="mt-4">
        <CheckoutForm formId="activation-checkout" />
      </div>
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
        <div className="mt-5 border-t border-line pt-4">
          <CheckoutForm formId="settings-checkout" />
        </div>
      )}
    </div>
  );
}
