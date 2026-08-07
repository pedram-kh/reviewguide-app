import { jwtVerify } from "jose";

/**
 * Session cookie verification (SPRINT_04.md ticket 4.2).
 *
 * The cookie holds the JWT `POST /api/auth/verify` returns verbatim — there's no separate
 * server-side session store. `AUTH_JWT_SECRET` is shared with the backend's server environment
 * (never this app's client bundle, never a `NEXT_PUBLIC_*` var) so this app can verify a
 * session's signature locally, in `middleware.ts`'s Edge runtime, without a network round trip
 * to the backend on every request. `jose` (not the more common `jsonwebtoken`/PyJWT-style libs)
 * specifically because it works in both the Node runtime (the /app Server Component) and the
 * Edge runtime (middleware) with the same API — most JWT libraries only support one or the
 * other.
 */
export const SESSION_COOKIE_NAME = "session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, matches the backend's SESSION_TTL

export interface SessionPayload {
  customerId: string;
  email: string;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    // Fail closed, same posture as the backend's require_admin_key and this app's own
    // middleware Basic Auth: an unset secret must deny every session, never accept one.
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    if (typeof payload.email !== "string" || typeof payload.sub !== "string") return null;
    return { customerId: payload.sub, email: payload.email };
  } catch {
    // Expired, malformed, or signature mismatch — all treated identically as "not logged in".
    return null;
  }
}
