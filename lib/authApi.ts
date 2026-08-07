import "server-only";

/**
 * Server-only client for the backend's public auth endpoints (SPRINT_04.md ticket 4.2).
 *
 * Unlike lib/api.ts's backendFetch, these calls carry no X-Admin-Key — /api/auth/request-link
 * and /api/auth/verify are meant to be called by anonymous visitors (via this app's own server,
 * never directly from the browser, same "server-only" discipline as the admin API). `import
 * "server-only"` still applies here even though there's no secret to protect on this particular
 * path, so a future refactor can't accidentally start calling this from a Client Component.
 */

export class AuthApiError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "AuthApiError";
    this.status = status;
  }
}

async function authFetch<T>(path: string, body: unknown): Promise<T> {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    throw new Error("BACKEND_URL must be set in the server environment");
  }

  const response = await fetch(`${backendUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    const detail =
      typeof parsed === "object" && parsed !== null && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : text;
    throw new AuthApiError(response.status, detail);
  }

  return parsed as T;
}

export function requestMagicLink(email: string): Promise<{ message: string }> {
  return authFetch("/api/auth/request-link", { email });
}

export interface VerifyResult {
  session_token: string;
  email: string;
}

export function verifyMagicLinkToken(token: string): Promise<VerifyResult> {
  return authFetch("/api/auth/verify", { token });
}
