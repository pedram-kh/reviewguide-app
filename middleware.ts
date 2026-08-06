import { NextResponse, type NextRequest } from "next/server";

/**
 * HTTP Basic Auth gate for /admin/* (SPRINT_03.md ticket 3.2).
 *
 * ADMIN_USER / ADMIN_PASS live only in this app's Netlify env — a separate credential from the
 * backend's ADMIN_API_KEY, which never reaches the browser at all (see lib/api.ts). This just
 * keeps random visitors out of the dashboard UI; the backend's own X-Admin-Key auth is the real
 * boundary protecting the lead data.
 */
export function middleware(request: NextRequest): NextResponse {
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
  matcher: ["/admin", "/admin/:path*"],
};
