import { NextResponse, type NextRequest } from "next/server";

import { AuthApiError, verifyMagicLinkToken } from "@/lib/authApi";
import { getRequestOrigin, withNetlifyRedirectSafety } from "@/lib/requestOrigin";
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * The magic link itself points here: `{APP_URL}/auth/verify?token=...` (SPRINT_04.md ticket
 * 4.2). Exchanges the one-time token for a session by calling the backend, then sets the
 * session cookie and redirects — the token in the URL is spent the moment this runs (the
 * backend marks it used_at on the very first successful verify), so refreshing this URL a
 * second time correctly fails rather than silently logging in again.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return redirectToLogin(request, "missing_token");
  }

  let sessionToken: string;
  try {
    const result = await verifyMagicLinkToken(token);
    sessionToken = result.session_token;
  } catch (error) {
    const reason = error instanceof AuthApiError && error.status === 401 ? "invalid_link" : "error";
    return redirectToLogin(request, reason);
  }

  const appUrl = withNetlifyRedirectSafety(new URL("/app", getRequestOrigin(request)));
  const response = NextResponse.redirect(appUrl);
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

function redirectToLogin(request: NextRequest, reason: string): NextResponse {
  const url = new URL("/login", getRequestOrigin(request));
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}
