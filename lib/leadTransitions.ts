import type { LeadStatus } from "@/lib/api";

/**
 * UI-only mirror of the backend's ALLOWED_TRANSITIONS (app/routers/admin.py,
 * reviewpilot-backend, LOGIC.md §3, amended 2026-08-06). This is purely for disabling buttons
 * that would otherwise 422 — the backend is the actual enforcement point and re-validates every
 * PATCH regardless of what this file says.
 */
export const ALLOWED_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ["response_generated", "dead"],
  response_generated: ["enriched", "dead"],
  enriched: ["queued", "dead"],
  queued: ["sent", "dead"],
  sent: ["replied", "dead"],
  replied: ["converted", "dead"],
  converted: [],
  dead: [],
};

// LOGIC.md §3: skips to `dead` from before a human ever sent anything require a note.
export const PRE_SENT_STATUSES: readonly LeadStatus[] = [
  "new",
  "response_generated",
  "enriched",
  "queued",
];

export function canTransitionTo(from: LeadStatus, to: LeadStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isHealthGuardedStatus(status: LeadStatus): boolean {
  return status === "queued" || status === "sent";
}

// LOGIC.md §3 path to `sent`: new -> response_generated -> enriched -> queued -> sent. UAT-1
// (ticket 3.4-UAT): "Mark sent disabled" is not self-explanatory on its own — spell out exactly
// which earlier steps are still missing, or that the lead is already past this point.
const STEPS_STILL_MISSING_BEFORE_SENT: Partial<Record<LeadStatus, string>> = {
  new: "still needs a response generated, enrichment, and queueing",
  response_generated: "still needs enrichment and queueing",
  enriched: "still needs to be queued",
};

export function explainWhyNotSendable(status: LeadStatus): string {
  const readableStatus = status.replaceAll("_", " ");
  const missing = STEPS_STILL_MISSING_BEFORE_SENT[status];
  if (missing) return `Lead ${missing} before it can be marked sent (currently: ${readableStatus}).`;
  return `Lead is already '${readableStatus}' — it can't be marked sent from here.`;
}
