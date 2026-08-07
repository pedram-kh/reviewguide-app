import { NextResponse, type NextRequest } from "next/server";

import { AuthApiError, verifyMagicLinkToken } from "@/lib/authApi";
import { getRequestOrigin, withNetlifyRedirectSafety } from "@/lib/requestOrigin";
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * The actual token-consuming step (SPRINT_04.md ticket 4.2b). Split out of `/auth/verify` (now a
 * GET-only interstitial page, see app/(customer)/auth/verify/page.tsx) after a live real-Postmark
 * test showed a mailbox provider's automated link-prescanning/safe-links feature was clicking the
 * emailed link — and consuming its single-use token — before the human recipient ever saw the
 * email. A human must now submit the interstitial's form (a real POST) for the token to be
 * consumed; an automated GET can no longer burn it.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const token = formData.get("token");

  if (typeof token !== "string" || !token) {
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
  const response = NextResponse.redirect(appUrl, { status: 303 });
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
  return NextResponse.redirect(url, { status: 303 });
}
