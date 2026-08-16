const WARSAW = "Europe/Warsaw";

// Ticket 6.3: both en-GB admin formatters below and the pl-PL customer ones further down had the
// same defect — no explicit `timeZone`, so the string depends on the host machine's zone, and any
// of these called from a "use client" component (confirmed for both: `ReplyRow.tsx`'s
// formatDateTime, `LeadDetailClient.tsx`'s formatDate) hydration-mismatches (React #418) whenever
// the Next.js server's zone differs from the browser's. Pinned to Warsaw for all of them — Warsaw
// is the product's established constant (ROADMAP §4b's geographic-scope decision), not because
// admin viewers are necessarily in Warsaw, but because a *consistent* pinned zone is what removes
// the mismatch; en-GB output with a Warsaw `timeZone` still reads as e.g. "16 Aug 2026", unaffected
// by locale.
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: WARSAW,
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: WARSAW });
}

// pl-PL variant for the customer product (ticket 5.3: "PL copy: plain, no marketing voice inside
// the product") — distinct from formatDate/formatDateTime above, which are en-GB and used only by
// /admin's internal, non-customer-facing UI.
export function formatDateTimePl(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: WARSAW,
  });
}

export function formatDatePl(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pl-PL", {
    dateStyle: "medium",
    timeZone: WARSAW,
  });
}

/** YYYY-MM-DD in Europe/Warsaw, lexicographically sortable. */
export function warsawDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: WARSAW });
}
