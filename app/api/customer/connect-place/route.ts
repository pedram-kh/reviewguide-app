import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { connectPlace, CustomerApiError, type ConnectPlaceBody } from "@/lib/customerApi";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Server-side proxy for POST /api/customer/connect-place (ticket 5.3's connect-restaurant flow).
 * Unlike /api/billing/checkout this returns JSON rather than redirecting — the confirmation card
 * needs to show the day-one summary (drafts generated, digest sent) inline before the page
 * transitions to the post-connect home.
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
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CustomerApiError) {
      return NextResponse.json({ detail: err.message, body: err.body }, { status: err.status });
    }
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
