import { NextResponse, type NextRequest } from "next/server";

import { getRequestOrigin } from "@/lib/requestOrigin";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

/**
 * Two independent gates in one middleware (SPRINT_03.md ticket 3.2 + SPRINT_04.md ticket 4.2):
 *
 * - /admin/*: HTTP Basic Auth (ADMIN_USER/ADMIN_PASS) — unchanged from ticket 3.2. Keeps random
 *   visitors out of the internal dashboard UI; the backend's own X-Admin-Key auth is the real
 *   boundary protecting the lead data.
 * - /app/*: customer session cookie (a JWT signed by the backend on magic-link verify) —
 *   entirely different audience and mechanism, so it's a separate branch, not a variant of the
 *   admin check. Missing/invalid/expired session -> redirect to /login, not a 401 (a customer
 *   hitting /app is a normal navigation, not an API caller).
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return checkAdminBasicAuth(request);
  }
  return checkCustomerSession(request);
}

function checkAdminBasicAuth(request: NextRequest): NextResponse {
  const expectedUser = process.env.ADMIN_USER;
  const expectedPass = process.env.ADMIN_PASS;

  // Fail closed: unset env vars deny every request rather than letting anyone through.
  if (!expectedUser || !expectedPass) {
    return unauthorized();
  }

  const credentials = parseBasicAuth(request.headers.get("authorization"));
  if (
    !credentials ||
    !timingSafeEqual(credentials.user, expectedUser) ||
    !timingSafeEqual(credentials.pass, expectedPass)
  ) {
    return unauthorized();
  }

  return NextResponse.next();
}

async function checkCustomerSession(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", getRequestOrigin(request));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

function parseBasicAuth(header: string | null): { user: string; pass: string } | null {
  if (!header?.startsWith("Basic ")) return null;

  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return null;
  }

  const separator = decoded.indexOf(":");
  if (separator === -1) return null;

  return { user: decoded.slice(0, separator), pass: decoded.slice(separator + 1) };
}

// Constant-time-ish string compare so a timing side-channel can't be used to brute-force the
// credentials one character at a time. Pads to a fixed length before comparing so early-exit
// length checks don't leak how close a guess is either.
function timingSafeEqual(actual: string, expected: string): boolean {
  const length = Math.max(actual.length, expected.length, 32);
  const a = actual.padEnd(length, "\0");
  const b = expected.padEnd(length, "\0");

  let mismatch = actual.length === expected.length ? 0 : 1;
  for (let i = 0; i < length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="ReviewGuide Admin"' },
  });
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/app", "/app/:path*"],
};
