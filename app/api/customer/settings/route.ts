import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { CustomerApiError, updateCustomerSettings, type UpdateSettingsBody } from "@/lib/customerApi";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/** Server-side proxy for PATCH /api/customer/settings (ticket 5.3's settings section). */
export async function PATCH(request: Request): Promise<NextResponse> {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ detail: "Missing session." }, { status: 401 });
  }

  let body: UpdateSettingsBody;
  try {
    body = (await request.json()) as UpdateSettingsBody;
  } catch {
    return NextResponse.json({ detail: "Request body must be JSON" }, { status: 400 });
  }

  try {
    const state = await updateCustomerSettings(sessionToken, body);
    return NextResponse.json(state);
  } catch (err) {
    if (err instanceof CustomerApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status });
    }
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
