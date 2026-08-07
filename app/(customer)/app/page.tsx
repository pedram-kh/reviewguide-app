import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DARK_GLASS_CARD } from "@/lib/theme";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

/**
 * The logged-in landing page (SPRINT_04.md ticket 4.2 — ticket 4.3 adds the subscription
 * status card and Stripe buttons here). middleware.ts already redirects unauthenticated
 * requests to /login before this ever runs, but the page re-verifies the cookie itself anyway
 * (cheap, local, no network call) rather than trusting the middleware ran — same "don't trust
 * the frontend, verify server-side" posture as the admin API's own status-transition checks.
 */
export default async function AppPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <div className={`${DARK_GLASS_CARD} w-full max-w-lg p-8`}>
        <p className="text-sm text-white/60">Zalogowano jako</p>
        <p className="mt-1 text-lg font-semibold text-white">{session.email}</p>

        <p className="mt-6 text-sm text-white/60">
          Subskrypcja: <span className="text-white">brak (ticket 4.3)</span>
        </p>

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
