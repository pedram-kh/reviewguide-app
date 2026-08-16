import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getBillingStatus } from "@/lib/billingApi";
import { getCustomerState } from "@/lib/customerApi";
import { CUSTOMER_CARD } from "@/lib/theme";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

import { CustomerPanel } from "./CustomerPanel";

const STATUS_LABELS: Record<string, string> = {
  none: "brak",
  trialing: "okres próbny",
  active: "aktywna",
  past_due: "zaległa płatność",
  canceled: "anulowana",
  unpaid: "nieopłacona",
  incomplete: "niedokończona",
  incomplete_expired: "wygasła",
  paused: "wstrzymana",
};

// A real Stripe subscription already exists for these statuses — matches the backend's own
// _ALREADY_SUBSCRIBED_STATUSES guard in app/routers/billing.py. Deliberately keyed off
// subscription_status itself, not has_subscription_ever_started (stripe_customer_id is set the
// moment a Checkout Session is first created, even if that checkout was abandoned/cancelled and
// no real subscription ever existed — that field answers "has a Stripe Customer record", not
// "has a subscription right now"). Found live 2026-08-08 (Stakeholder walkthrough): the old
// has_subscription_ever_started condition let a stale /app page still show "Rozpocznij okres
// próbny" after a subscription was already active, which is what produced the duplicate
// checkout in the first place.
const ALREADY_SUBSCRIBED_STATUSES = new Set(["trialing", "active"]);

/**
 * The logged-in landing page (SPRINT_04.md ticket 4.2 + ticket 4.3's status card/buttons).
 * middleware.ts already redirects unauthenticated requests to /login before this ever runs, but
 * the page re-verifies the cookie itself anyway (cheap, local, no network call) rather than
 * trusting the middleware ran — same "don't trust the frontend, verify server-side" posture as
 * the admin API's own status-transition checks.
 */
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkout?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !token) {
    redirect("/login");
  }

  const { error, checkout } = await searchParams;
  const status = await getBillingStatus(token).catch(() => null);
  const subscriptionStatus = status?.subscription_status ?? "none";
  const isAlreadySubscribed = ALREADY_SUBSCRIBED_STATUSES.has(subscriptionStatus);
  const customerState = await getCustomerState(token).catch(() => null);

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-6 py-16">
      <div className={`${CUSTOMER_CARD} w-full max-w-lg p-8`}>
        <p className="text-sm text-ink-soft">Zalogowano jako</p>
        <p className="mt-1 text-lg font-semibold text-ink">{session.email}</p>

        <p className="mt-6 text-sm text-ink-soft">
          Subskrypcja:{" "}
          <span className="font-medium text-ink">
            {STATUS_LABELS[subscriptionStatus] ?? subscriptionStatus}
          </span>
        </p>

        {checkout === "success" && (
          <p className="mt-3 rounded-lg border border-green/30 bg-green-soft px-3 py-2 text-sm text-green-ink">
            Dziękujemy! Okres próbny wkrótce się pojawi (chwilę zajmuje przetworzenie przez Stripe).
          </p>
        )}
        {error === "already_subscribed" && (
          <p className="mt-3 rounded-lg border border-gold/40 bg-cream-2 px-3 py-2 text-sm text-gold-ink">
            Masz już aktywną subskrypcję — zarządzaj nią poniżej, w portalu klienta.
          </p>
        )}
        {error && error !== "already_subscribed" && (
          <p className="mt-3 rounded-lg border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose-ink">
            Coś poszło nie tak z płatnościami. Spróbuj ponownie za chwilę.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {!isAlreadySubscribed ? (
            <form action="/api/billing/checkout" method="post" className="flex flex-col gap-3">
              {/* Ticket 6.6, part C — Terms § 8.3's withdrawal-waiver checkbox. `required` blocks
                  the native form POST without any JS, same as EmailAuthForm's signup checkbox;
                  the Route Handler + backend also re-check it server-side (see
                  app/api/billing/checkout/route.ts and app/routers/billing.py). */}
              <label className="flex items-start gap-2.5 text-left text-sm text-ink-soft">
                <input
                  type="checkbox"
                  name="immediate_start_consent"
                  value="true"
                  required
                  className="mt-0.5 size-4 shrink-0 rounded border-line accent-[var(--gold-deep)]"
                />
                <span>
                  Żądam niezwłocznego rozpoczęcia świadczenia Usługi i przyjmuję do wiadomości, że
                  po jej pełnym wykonaniu utracę prawo odstąpienia od Umowy.
                </span>
              </label>
              <button type="submit" className="btn btn-primary w-full">
                Rozpocznij okres próbny
              </button>
            </form>
          ) : (
            <form action="/api/billing/portal" method="post">
              <button type="submit" className="btn btn-ghost w-full">
                Zarządzaj subskrypcją
              </button>
            </form>
          )}
        </div>

        <form action="/api/auth/logout" method="post" className="mt-8">
          <button
            type="submit"
            className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-gold-deep/50 hover:text-ink"
          >
            Wyloguj
          </button>
        </form>
      </div>

      {customerState ? (
        <CustomerPanel initialState={customerState} isSubscribed={isAlreadySubscribed} />
      ) : (
        <div className={`${CUSTOMER_CARD} w-full max-w-lg p-6 text-sm text-ink-soft`}>
          Nie udało się wczytać panelu restauracji. Odśwież stronę za chwilę.
        </div>
      )}
    </div>
  );
}
