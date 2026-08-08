import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { CustomerApiError, getCustomerAlerts } from "@/lib/customerApi";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/** Server-side proxy for GET /api/customer/alerts (ticket 5.3's recent alerts list). */
export async function GET(): Promise<NextResponse> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ detail: "Missing session." }, { status: 401 });
  }

  try {
    const result = await getCustomerAlerts(sessionToken);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CustomerApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status });
    }
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
