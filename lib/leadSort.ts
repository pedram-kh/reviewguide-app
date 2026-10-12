import type { LeadSort } from "./api";

/**
 * Default sort for the admin leads list (LOGIC.md §6, amended 2026-10-12 by the PM).
 *
 * `status=queued` defaults to "expiring soonest" (`review_date_asc`, oldest review first): a lead
 * is only worth sending while its review is ≤30 days old (LOGIC §1 Q3), and the operator can send
 * ~20/day against a queue that is deeper than that, so working the queue oldest-first sends the
 * most leads before they cross the 30-day line, and the newer ones survive to be sent later.
 * Every other view keeps the original newest-review-first default (fresher review = stronger hook).
 *
 * An explicit `?sort=` always wins — this only supplies the value used when none is chosen.
 */
export function defaultLeadSort(status: string | undefined): LeadSort {
  return status === "queued" ? "review_date_asc" : "review_date_desc";
}

export function resolveLeadSort(sort: string | undefined, status: string | undefined): LeadSort {
  return (sort as LeadSort | undefined) || defaultLeadSort(status);
}
