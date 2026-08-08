import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { CustomerApiError, previewMapsUrl } from "@/lib/customerApi";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/** Server-side proxy for POST /api/customer/preview-maps-url (ticket 5.3's "wklej link" fallback). */
export async function POST(request: Request): Promise<NextResponse> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ detail: "Missing session." }, { status: 401 });
  }

  let body: { maps_url?: string };
  try {
    body = (await request.json()) as { maps_url?: string };
  } catch {
    return NextResponse.json({ detail: "Request body must be JSON" }, { status: 400 });
  }
  if (!body.maps_url) {
    return NextResponse.json({ detail: "maps_url is required" }, { status: 422 });
  }

  try {
    const result = await previewMapsUrl(sessionToken, body.maps_url);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CustomerApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status });
    }
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
