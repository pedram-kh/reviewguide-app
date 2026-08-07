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

  try {
    const { checkout_url: checkoutUrl } = await createCheckoutSession(sessionToken);
    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (error) {
    const reason = error instanceof BillingApiError ? "billing_error" : "error";
    const appUrl = new URL("/app", getRequestOrigin(request));
    appUrl.searchParams.set("error", reason);
    return NextResponse.redirect(appUrl, { status: 303 });
  }
}
