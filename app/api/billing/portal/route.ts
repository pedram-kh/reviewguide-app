import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { BillingApiError, createPortalSession } from "@/lib/billingApi";
import { getRequestOrigin, withNetlifyRedirectSafety } from "@/lib/requestOrigin";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * "Zarządzaj subskrypcją" on /app posts here and gets redirected to Stripe's hosted Customer
 * Portal (SPRINT_04.md ticket 4.3). A POST from the app's own form even though the backend's
 * endpoint is itself a GET (per the ticket's literal spec) — same reasoning as ticket 4.2b's
 * interstitial: a button-triggered action shouldn't live behind a plain GET a prefetcher or
 * scanner could trigger as a side effect (here: needlessly minting a short-lived portal session).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.redirect(withNetlifyRedirectSafety(new URL("/login", getRequestOrigin(request))));
  }

  try {
    const { portal_url: portalUrl } = await createPortalSession(sessionToken);
    return NextResponse.redirect(portalUrl, { status: 303 });
  } catch (error) {
    const reason = error instanceof BillingApiError ? "billing_error" : "error";
    const appUrl = new URL("/app", getRequestOrigin(request));
    appUrl.searchParams.set("error", reason);
    return NextResponse.redirect(appUrl, { status: 303 });
  }
}
