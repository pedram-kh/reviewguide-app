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
