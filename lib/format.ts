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
export function formatDateTimePl(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });
}
