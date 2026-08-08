import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { CustomerApiError, searchPlace } from "@/lib/customerApi";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/** Server-side proxy for GET /api/customer/search-place (ticket 5.3's connect-restaurant search box). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ detail: "Missing session." }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";

  try {
    const result = await searchPlace(sessionToken, q);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CustomerApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status });
    }
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
