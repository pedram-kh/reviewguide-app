import type { LeadStatus } from "@/lib/api";

/**
 * Shared per-status color palette (styling only, UI polish round 2) — one definition so the
 * dashboard's stat-card icons and the lead detail page's status pill can't drift apart.
 * Kept as plain literal strings so Tailwind's static scanner can see every class.
 */
export const STATUS_BADGE: Record<LeadStatus, string> = {
  new: "bg-slate-100 text-slate-600",
  response_generated: "bg-blue-100 text-blue-600",
  enriched: "bg-purple-100 text-purple-600",
  queued: "bg-amber-100 text-amber-600",
  sent: "bg-indigo-100 text-indigo-600",
  replied: "bg-cyan-100 text-cyan-600",
  converted: "bg-emerald-100 text-emerald-600",
  dead: "bg-rose-100 text-rose-600",
};
