import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { connectPlace, CustomerApiError, type ConnectPlaceBody } from "@/lib/customerApi";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Server-side proxy for POST /api/customer/connect-place (ticket 5.3's connect-restaurant flow).
 * Unlike /api/billing/checkout this returns JSON rather than redirecting — the confirmation card
 * needs to know the connect landed before the page transitions to the post-connect home.
 *
 * Ticket 6.1: the backend answers 202 here now, and that status is forwarded rather than flattened
 * to 200. It used to answer 200 only after finishing the whole day-one job (Outscraper + up to ten
 * sequential Claude calls + the digest email — 58 seconds, measured on a real connect), which this
 * handler waited out. It could not: a route handler runs as a Netlify serverless function capped at
 * 10s by default and 26s at most, so the function was killed mid-wait and Netlify returned its own
 * HTML error page. The browser parsed that as JSON and showed the customer a raw
 * `Unexpected token '<'` for a connect that had actually succeeded.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ detail: "Missing session." }, { status: 401 });
  }

  let body: ConnectPlaceBody;
  try {
    body = (await request.json()) as ConnectPlaceBody;
  } catch {
    return NextResponse.json({ detail: "Request body must be JSON" }, { status: 400 });
  }

  try {
    const result = await connectPlace(sessionToken, body);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof CustomerApiError) {
      return NextResponse.json({ detail: err.message, body: err.body }, { status: err.status });
    }
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
