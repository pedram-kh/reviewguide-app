import { NextResponse } from "next/server";

import { getRequestOrigin, withNetlifyRedirectSafety } from "@/lib/requestOrigin";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Not explicitly in SPRINT_04.md ticket 4.2's spec, but a bare minimum for the auth system to
 * be usable/testable at all — without it there's no way to end a session short of waiting out
 * the 30-day cookie or clearing browser storage by hand. Flagged here as a small disclosed
 * addition rather than silently bundled in.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const loginUrl = withNetlifyRedirectSafety(new URL("/login", getRequestOrigin(request)));
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
