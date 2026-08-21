import "server-only";

/**
 * Server-only fetch wrapper to the FastAPI backend (SPRINT_03.md tickets 3.2, 3.3).
 *
 * `import "server-only"` makes any accidental import of this file from a Client Component fail
 * the build, rather than silently bundling ADMIN_API_KEY into JS shipped to the browser. Server
 * Components (list/detail pages) call these functions directly. Client Components (Save / Mark
 * sent / Skip / notes autosave) cannot import this file at all — they go through the
 * app/api/leads/* route handlers instead, which run on the server and call these same functions.
 * Either way, the key never crosses into browser code.
 */

export class BackendApiError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "BackendApiError";
    this.status = status;
  }
}

async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const backendUrl = process.env.BACKEND_URL;
  const adminApiKey = process.env.ADMIN_API_KEY;
  if (!backendUrl || !adminApiKey) {
    throw new Error("BACKEND_URL and ADMIN_API_KEY must be set in the server environment");
  }

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      "X-Admin-Key": adminApiKey,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    // Admin data (stats, lead statuses) must always be current — never serve a stale cache.
    cache: "no-store",
  });

  // One read, one guarded parse, for both paths. The success path used to call `response.json()`
  // bare, so a 2xx carrying a non-JSON body (a gateway's HTML page) escaped as a raw `SyntaxError`
  // instead of a `BackendApiError` the admin pages know how to render (ticket 6.2's sweep — the
  // browser-side equivalent of this guard lives in `lib/readJson.ts`).
  const body = await response.text();
  let parsed: unknown = null;
  let parseFailed = false;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parseFailed = true;
  }

  if (!response.ok) {
    // FastAPI's HTTPException body is {"detail": "..."} — surface that message verbatim
    // (e.g. "Illegal transition ... (LOGIC.md §3)") instead of a generic failure string.
    const detail = (parsed as { detail?: unknown } | null)?.detail;
    throw new BackendApiError(response.status, typeof detail === "string" ? detail : body);
  }

  if (parseFailed || parsed === null) {
    // Truncated: if this is an HTML error page, the first line identifies it and the rest is noise.
    throw new BackendApiError(response.status, `Backend returned a non-JSON body: ${body.slice(0, 200)}`);
  }

  return parsed as T;
}

// --- stats (ticket 3.2) ---------------------------------------------------------------------

export interface StatsResponse {
  by_status: Record<string, number>;
  sent_today: number;
  sent_by_channel: Record<string, number>;
  replies: number;
  // replies / total-ever-sent, as a fraction (0.0-1.0) — the G2 gate metric (ticket 3.4). 0.0
  // when nothing has been sent yet.
  reply_rate: number;
}

export function getStats(): Promise<StatsResponse> {
  return backendFetch<StatsResponse>("/api/admin/stats");
}

// --- leads (ticket 3.3) ---------------------------------------------------------------------

export type LeadStatus =
  | "new"
  | "response_generated"
  | "enriched"
  | "queued"
  | "sent"
  | "replied"
  | "converted"
  | "dead";

export type LeadSort = "review_date_asc" | "review_date_desc" | "created_at";

export interface LeadListItem {
  lead_id: number;
  status: LeadStatus;
  channel: string | null;
  health_flag: boolean;
  place_id: string;
  place_name: string | null;
  rating: number | null;
  review_date: string | null;
  review_snippet: string | null;
  created_at: string;
}

export interface PlaceInfo {
  place_id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  fb_url: string | null;
  email: string | null;
  // UAT-3 (3.4-UAT): place-level enrichment for the lead detail header.
  rating: number | null;
  reviews_count: number | null;
  lat: number | null;
  lng: number | null;
  google_maps_url: string | null;
}

export interface ReviewInfo {
  review_id: string;
  rating: number | null;
  text: string | null;
  author: string | null;
  review_date: string | null;
  has_owner_reply: boolean | null;
}

export interface LeadDetail {
  lead_id: number;
  status: LeadStatus;
  channel: string | null;
  health_flag: boolean;
  notes: string | null;
  generated_response: string | null;
  generation_stop_reason: string | null;
  outreach_message: string | null;
  sent_at: string | null;
  replied_at: string | null;
  created_at: string;
  place: PlaceInfo;
  review: ReviewInfo;
}

export interface LeadListFilters {
  status?: LeadStatus;
  channel?: string;
  health_flag?: boolean;
  search?: string;
  sort?: LeadSort;
}

export function listLeads(filters: LeadListFilters = {}): Promise<LeadListItem[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.health_flag !== undefined) params.set("health_flag", String(filters.health_flag));
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);

  const query = params.toString();
  return backendFetch<LeadListItem[]>(`/api/admin/leads${query ? `?${query}` : ""}`);
}

export function getLead(leadId: number): Promise<LeadDetail> {
  return backendFetch<LeadDetail>(`/api/admin/leads/${leadId}`);
}

export interface LeadPatchBody {
  status?: LeadStatus;
  notes?: string;
  generated_response?: string;
  outreach_message?: string;
  channel?: string;
  confirm_health_reviewed?: boolean;
}

export function patchLead(leadId: number, body: LeadPatchBody): Promise<LeadDetail> {
  return backendFetch<LeadDetail>(`/api/admin/leads/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// --- customers (ticket 5.6, admin view of System B — read-only) --------------------------------

export interface CustomerListItem {
  customer_id: number;
  email: string;
  place_name: string | null;
  subscription_status: string;
  connected_at: string | null;
  last_alert_at: string | null;
  is_test: boolean;
}

export interface CustomerPlaceInfo {
  place_id: string;
  name: string | null;
  address: string | null;
  rating: number | null;
  last_polled_at: string | null;
}

export interface CustomerAlertHistoryItem {
  alert_id: number;
  review_id: string;
  review_text: string | null;
  review_rating: number | null;
  review_date: string | null;
  response_text: string;
  is_urgent: boolean;
  kind: string;
  sent_at: string | null;
  postmark_message_id: string | null;
  generation_stop_reason: string | null;
  created_at: string;
  // Ticket 6.4. Null for alerts written before migration 010 and for day-one welcome digests,
  // which no poll run produced — the UI groups those by date instead.
  run_id: string | null;
}

export interface DeliveryStatusItem {
  postmark_message_id: string;
  status: string | null;
}

export interface CustomerDetail {
  customer_id: number;
  email: string;
  notification_email: string | null;
  tone_preference: string;
  subscription_status: string;
  created_at: string;
  connected_at: string | null;
  is_test: boolean;
  place: CustomerPlaceInfo | null;
  alerts: CustomerAlertHistoryItem[];
  recent_delivery_statuses: DeliveryStatusItem[];
}

export function listCustomers(): Promise<CustomerListItem[]> {
  return backendFetch<CustomerListItem[]>("/api/admin/customers");
}

export function getCustomer(customerId: number): Promise<CustomerDetail> {
  return backendFetch<CustomerDetail>(`/api/admin/customers/${customerId}`);
}

// Ticket 6.18 — the panel's first write action, ending the "manual UPDATE over the bastion
// tunnel" era for the recurring is_test mis-flag (customers 16, 18/19, 20, 25/26). Narrow on
// purpose: only is_test is writable, same scope the backend's PATCH endpoint enforces.
export interface CustomerPatchBody {
  is_test: boolean;
}

export function patchCustomer(
  customerId: number,
  body: CustomerPatchBody
): Promise<CustomerDetail> {
  return backendFetch<CustomerDetail>(`/api/admin/customers/${customerId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// --- poll runs (ticket 6.4, admin observability for the 2h poller — read-only) -----------------

export interface PollRunListItem {
  run_id: string;
  started_at: string;
  // Null means the run never reported back — a crash, not a quiet run. Rendered as a warning.
  finished_at: string | null;
  trigger_source: string;
  customers_polled: number;
  records_fetched: number;
  new_alerts: number;
  emails_sent: number;
  backfilled: number;
  skipped: number;
  deferred: number;
  aborted: boolean;
  error_note: string | null;
}

export interface RunAlertItem {
  alert_id: number;
  review_id: string;
  review_text: string | null;
  review_rating: number | null;
  review_date: string | null;
  response_text: string;
  is_urgent: boolean;
  sent_at: string | null;
  postmark_message_id: string | null;
  generation_stop_reason: string | null;
  created_at: string;
}

export interface RunCustomerBreakdown {
  customer_id: number;
  email: string;
  place_name: string | null;
  alerts: RunAlertItem[];
}

export interface PollRunDetail extends PollRunListItem {
  customers: RunCustomerBreakdown[];
}

export function listRuns(): Promise<PollRunListItem[]> {
  return backendFetch<PollRunListItem[]>("/api/admin/runs");
}

export function getRun(runId: string): Promise<PollRunDetail> {
  return backendFetch<PollRunDetail>(`/api/admin/runs/${encodeURIComponent(runId)}`);
}
