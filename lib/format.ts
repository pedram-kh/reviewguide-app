const WARSAW = "Europe/Warsaw";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

// pl-PL variant for the customer product (ticket 5.3: "PL copy: plain, no marketing voice inside
// the product") — distinct from formatDate/formatDateTime above, which are en-GB and used only by
// /admin's internal, non-customer-facing UI.
//
// Ticket 6.9 pins `timeZone: Europe/Warsaw` because Historia/Najnowsze group by Warsaw calendar
// day and the hero's "ostatnie sprawdzenie" line is rendered from a client component. Without
// the pin, the string depends on the host zone (UTC on the Next server, Warsaw in the browser)
// and React throws #418 — the still-open ticket 6.3 defect. Overlap disclosed in the 6.9 report;
// 6.3's dedicated formatter test is not added here.
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
