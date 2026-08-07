import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getBillingStatus } from "@/lib/billingApi";
import { DARK_GLASS_CARD } from "@/lib/theme";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

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
  const hasStartedSubscription = status?.has_subscription_ever_started ?? false;

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <div className={`${DARK_GLASS_CARD} w-full max-w-lg p-8`}>
        <p className="text-sm text-white/60">Zalogowano jako</p>
        <p className="mt-1 text-lg font-semibold text-white">{session.email}</p>

        <p className="mt-6 text-sm text-white/60">
          Subskrypcja:{" "}
          <span className="text-white">
            {STATUS_LABELS[subscriptionStatus] ?? subscriptionStatus}
          </span>
        </p>

        {checkout === "success" && (
          <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
            Dziękujemy! Okres próbny wkrótce się pojawi (chwilę zajmuje przetworzenie przez Stripe).
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            Coś poszło nie tak z płatnościami. Spróbuj ponownie za chwilę.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {!hasStartedSubscription ? (
            <form action="/api/billing/checkout" method="post">
              <button
                type="submit"
                className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Rozpocznij okres próbny
              </button>
            </form>
          ) : (
            <form action="/api/billing/portal" method="post">
              <button
                type="submit"
                className="w-full rounded-full border border-white/15 px-4 py-2.5 text-sm text-white transition-colors hover:border-white/30"
              >
                Zarządzaj subskrypcją
              </button>
            </form>
          )}
        </div>

        <form action="/api/auth/logout" method="post" className="mt-8">
          <button
            type="submit"
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition-colors hover:border-white/30 hover:text-white"
          >
            Wyloguj
          </button>
        </form>
      </div>
    </div>
  );
}
