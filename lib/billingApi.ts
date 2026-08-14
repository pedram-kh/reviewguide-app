import "server-only";

/**
 * Server-only client for the backend's Stripe test-mode billing endpoints (SPRINT_04.md ticket
 * 4.3). Authenticated by forwarding the session cookie's own JWT as a Bearer token — the backend
 * decodes and verifies it independently (app/auth.py's decode_session_token) rather than being
 * told a customer_id it would otherwise have to trust blindly, same principle as lib/authApi.ts
 * never carrying an X-Admin-Key.
 */

export class BillingApiError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "BillingApiError";
    this.status = status;
  }
}

async function billingFetch<T>(
  path: string,
  sessionToken: string,
  init?: { method?: "GET" | "POST"; body?: unknown }
): Promise<T> {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    throw new Error("BACKEND_URL must be set in the server environment");
  }

  const response = await fetch(`${backendUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
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
    throw new BillingApiError(response.status, detail);
  }

  return parsed as T;
}

export interface BillingStatus {
  subscription_status: string;
  has_subscription_ever_started: boolean;
}

export function getBillingStatus(sessionToken: string): Promise<BillingStatus> {
  return billingFetch("/api/billing/status", sessionToken);
}

export function createCheckoutSession(
  sessionToken: string,
  immediateStartConsent: boolean
): Promise<{ checkout_url: string }> {
  return billingFetch("/api/billing/checkout", sessionToken, {
    method: "POST",
    body: { immediate_start_consent: immediateStartConsent },
  });
}

export function createPortalSession(sessionToken: string): Promise<{ portal_url: string }> {
  return billingFetch("/api/billing/portal", sessionToken);
}
