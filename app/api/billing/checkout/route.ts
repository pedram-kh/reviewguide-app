import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { BillingApiError, createCheckoutSession } from "@/lib/billingApi";
import { getRequestOrigin, withNetlifyRedirectSafety } from "@/lib/requestOrigin";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * "Rozpocznij okres próbny" on /app posts here (a plain form, not client-side JS — same
 * no-JS-required pattern as /api/auth/logout) and gets redirected straight to Stripe's own
 * hosted Checkout page (SPRINT_04.md ticket 4.3).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.redirect(withNetlifyRedirectSafety(new URL("/login", getRequestOrigin(request))));
  }

  // Ticket 6.6, part C — the /app form posts a plain (non-JS) checkbox named
  // "immediate_start_consent"; the browser's own `required` attribute already blocks submission
  // when it's unticked, but this Route Handler re-checks it server-side too (defense in depth,
  // same posture as the backend's own re-check in app/routers/billing.py) before ever calling
  // the backend.
  const formData = await request.formData();
  const immediateStartConsent = formData.get("immediate_start_consent") === "true";
  if (!immediateStartConsent) {
    const appUrl = new URL("/app", getRequestOrigin(request));
    appUrl.searchParams.set("error", "billing_error");
    return NextResponse.redirect(appUrl, { status: 303 });
  }

  try {
    const { checkout_url: checkoutUrl } = await createCheckoutSession(
      sessionToken,
      immediateStartConsent
    );
    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (error) {
    // 409 = backend's _ALREADY_SUBSCRIBED_STATUSES guard (found live 2026-08-08) — a distinct,
    // friendlier message than the generic billing_error catch-all, since it's an expected state
    // (stale page / double click) rather than an actual failure.
    let reason = "error";
    if (error instanceof BillingApiError) {
      reason = error.status === 409 ? "already_subscribed" : "billing_error";
    }
    const appUrl = new URL("/app", getRequestOrigin(request));
    appUrl.searchParams.set("error", reason);
    return NextResponse.redirect(appUrl, { status: 303 });
  }
}
