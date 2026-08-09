import "server-only";

/**
 * Server-only client for the backend's customer-product endpoints (SPRINT_05.md tickets 5.1 +
 * 5.3). Same shape as lib/billingApi.ts: forwards the session cookie's own JWT as a Bearer token,
 * the backend re-verifies it independently (app/auth.py's get_current_customer) rather than being
 * told a customer_id the caller could otherwise just claim.
 */

export class CustomerApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, detail: string, body: unknown) {
    super(detail);
    this.name = "CustomerApiError";
    this.status = status;
    this.body = body;
  }
}

async function customerFetch<T>(
  path: string,
  sessionToken: string,
  init?: { method?: "GET" | "POST" | "PATCH"; body?: unknown }
): Promise<T> {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    throw new Error("BACKEND_URL must be set in the server environment");
  }

  const response = await fetch(`${backendUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
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
        ? (parsed as { detail: unknown }).detail
        : text;
    const message = typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new CustomerApiError(response.status, message, detail);
  }

  return parsed as T;
}

export interface SearchPlaceResult {
  place_id: string;
  name: string | null;
  address: string | null;
  rating: number | null;
}

export function searchPlace(sessionToken: string, q: string): Promise<{ results: SearchPlaceResult[] }> {
  return customerFetch(`/api/customer/search-place?q=${encodeURIComponent(q)}`, sessionToken);
}

export function previewMapsUrl(
  sessionToken: string,
  mapsUrl: string
): Promise<{ place_id: string | null; suggested_query: string | null }> {
  return customerFetch("/api/customer/preview-maps-url", sessionToken, {
    method: "POST",
    body: { maps_url: mapsUrl },
  });
}

export interface ConnectPlaceBody {
  place_id?: string;
  maps_url?: string;
  name?: string | null;
  address?: string | null;
  rating?: number | null;
}

export interface DayOneSummary {
  fetched_from_api: boolean;
  reviews_considered: number;
  reviews_qualifying: number;
  drafts_generated: number;
  digest_sent: boolean;
  capped: boolean;
  cap_error: string | null;
}

/**
 * Ticket 6.1: connect-place now answers 202 as soon as the connection is committed, and the day-one
 * job runs behind it — so this no longer carries the day-one summary. That arrives later, via
 * `CustomerState.day_one`, which the panel polls until the run finishes.
 */
export interface ConnectPlaceResult {
  place_id: string;
  name: string | null;
  day_one_started: boolean;
}

export function connectPlace(
  sessionToken: string,
  body: ConnectPlaceBody
): Promise<ConnectPlaceResult> {
  return customerFetch("/api/customer/connect-place", sessionToken, { method: "POST", body });
}

export interface PlaceInfo {
  place_id: string;
  name: string | null;
  address: string | null;
  rating: number | null;
  last_polled_at: string | null;
}

/**
 * Ticket 6.1. `running` means the day-one job is in flight right now; `stale` means it started but
 * never recorded a finish — in practice an App Runner restart (every deploy) landing mid-run — and
 * tells the panel to stop waiting rather than poll forever. `summary` is populated only once the run
 * has finished (`done` or `failed`).
 */
export type DayOneStatus = "not_started" | "running" | "done" | "failed" | "stale";

export interface DayOneRunState {
  status: DayOneStatus;
  summary: DayOneSummary | null;
}

export interface CustomerState {
  email: string;
  notification_email: string | null;
  tone_preference: string;
  connected_at: string | null;
  place: PlaceInfo | null;
  day_one: DayOneRunState;
}

export function getCustomerState(sessionToken: string): Promise<CustomerState> {
  return customerFetch("/api/customer/state", sessionToken);
}

export interface UpdateSettingsBody {
  notification_email?: string;
  tone_preference?: string;
}

export function updateCustomerSettings(
  sessionToken: string,
  body: UpdateSettingsBody
): Promise<CustomerState> {
  return customerFetch("/api/customer/settings", sessionToken, { method: "PATCH", body });
}

export interface AlertItem {
  alert_id: number;
  review_id: string;
  review_text: string | null;
  review_rating: number | null;
  review_date: string | null;
  response_text: string;
  is_urgent: boolean;
  kind: string;
  sent_at: string | null;
  created_at: string;
}

export function getCustomerAlerts(sessionToken: string): Promise<{ alerts: AlertItem[] }> {
  return customerFetch("/api/customer/alerts", sessionToken);
}
