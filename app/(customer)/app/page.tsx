import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getBillingStatus } from "@/lib/billingApi";
import { getCustomerState } from "@/lib/customerApi";
import { CUSTOMER_CARD } from "@/lib/theme";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

import { CustomerPanel } from "./CustomerPanel";

const ALREADY_SUBSCRIBED_STATUSES = new Set(["trialing", "active"]);

/**
 * The logged-in landing page (SPRINT_04.md ticket 4.2 + ticket 4.3's status card/buttons).
 * Ticket 6.9 removes the "Zalogowano jako" card: email, manage-subscription and logout live in
 * the header menu; subscription status is a chip on the restaurant hero. Checkout banners and
 * the trial-start form (consent checkbox) stay — banners above the panel, the form in Ustawienia.
 *
 * middleware.ts already redirects unauthenticated requests to /login before this ever runs, but
 * the page re-verifies the cookie itself anyway (cheap, local, no network call) rather than
 * trusting the middleware ran.
 */
export default async function AppPage({
  searchParams,
}: {
  // `tab` itself is read client-side (CustomerPanel's useSearchParams(), ticket 6.9a) — this
  // server component only needs the two banner params.
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
    <div className="flex flex-1 flex-col items-center gap-6 px-6 py-10 sm:py-12">
      {checkout === "success" && (
        <p className="w-full max-w-2xl rounded-lg border border-green/30 bg-green-soft px-3 py-2 text-sm text-green-ink">
          Dziękujemy! Okres próbny wkrótce się pojawi (chwilę zajmuje przetworzenie przez Stripe).
        </p>
      )}
      {error === "already_subscribed" && (
        <p className="w-full max-w-2xl rounded-lg border border-gold/40 bg-cream-2 px-3 py-2 text-sm text-gold-ink">
          Masz już aktywną subskrypcję — zarządzaj nią z menu konta.
        </p>
      )}
      {error && error !== "already_subscribed" && (
        <p className="w-full max-w-2xl rounded-lg border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose-ink">
          Coś poszło nie tak z płatnościami. Spróbuj ponownie za chwilę.
        </p>
      )}

      {customerState ? (
        <CustomerPanel
          initialState={customerState}
          isSubscribed={isAlreadySubscribed}
          subscriptionStatus={subscriptionStatus}
        />
      ) : (
        <div className={`${CUSTOMER_CARD} w-full max-w-2xl p-6 text-sm text-ink-soft`}>
          Nie udało się wczytać panelu restauracji. Odśwież stronę za chwilę.
        </div>
      )}
    </div>
  );
}
