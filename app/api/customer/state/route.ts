import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { CustomerApiError, getCustomerState } from "@/lib/customerApi";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Server-side proxy for GET /api/customer/state (ticket 5.3). CustomerPanel (client component
 * on /app) calls this same-origin route to (re)load connect/settings/alerts state after an
 * action like connect or a settings save — lib/customerApi.ts is `server-only`, so it can only
 * run here, never in the browser bundle.
 */
export async function GET(): Promise<NextResponse> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ detail: "Missing session." }, { status: 401 });
  }

  try {
    const state = await getCustomerState(sessionToken);
    return NextResponse.json(state);
  } catch (err) {
    if (err instanceof CustomerApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status });
    }
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
