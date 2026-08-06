import Link from "next/link";

import { listLeads, type LeadListFilters, type LeadListItem, type LeadSort, type LeadStatus } from "@/lib/api";
import { formatDate } from "@/lib/format";

import { LeadsFilterBar } from "./LeadsFilterBar";

// Filters/sort change what's shown — never serve a cached list.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const GRID_COLS = "grid grid-cols-[130px_100px_28px_1fr_60px_110px_2fr]";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const filters: LeadListFilters = {
    status: first(sp.status) as LeadStatus | undefined,
    channel: first(sp.channel),
    health_flag: first(sp.health_flag) === undefined ? undefined : first(sp.health_flag) === "true",
    search: first(sp.search),
    sort: (first(sp.sort) as LeadSort | undefined) ?? "review_date_desc",
  };

  let leads: LeadListItem[] = [];
  let error: string | null = null;
  try {
    leads = await listLeads(filters);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load leads";
  }

  // Carry the exact filter/sort state into the detail page link, so "Mark sent"/"Skip" can
  // return here with the same view instead of resetting to defaults (ticket 3.3: "return to
  // list (filtered as before)").
  const fromQuery = new URLSearchParams();
  for (const key of ["status", "channel", "health_flag", "search", "sort"]) {
    const value = first(sp[key]);
    if (value) fromQuery.set(key, value);
  }
  const fromParam = fromQuery.toString();

  const toast = first(sp.toast);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Leads</h1>
        <Link href="/admin" className="text-sm text-zinc-500 underline">
          Stats
        </Link>
      </div>

      {toast === "sent" && <ToastBanner text="Marked as sent." />}
      {toast === "skipped" && <ToastBanner text="Lead skipped to dead." />}

      <div className="mt-6">
        <LeadsFilterBar />
      </div>

      {error ? (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load leads: {error}
        </div>
      ) : leads.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No leads match these filters.</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
          <div
            className={`${GRID_COLS} gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500`}
          >
            <span>Status</span>
            <span>Channel</span>
            <span />
            <span>Restaurant</span>
            <span>Rating</span>
            <span>Review date</span>
            <span>Snippet</span>
          </div>
          <div className="divide-y divide-zinc-100 bg-white">
            {leads.map((lead) => (
              <Link
                key={lead.lead_id}
                href={`/admin/leads/${lead.lead_id}${fromParam ? `?from=${encodeURIComponent(fromParam)}` : ""}`}
                className={`${GRID_COLS} items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-50`}
              >
                <span className="truncate">{lead.status.replaceAll("_", " ")}</span>
                <span className="truncate text-zinc-500">{lead.channel ?? "—"}</span>
                <span>{lead.health_flag ? "⚠️" : ""}</span>
                <span className="truncate font-medium text-zinc-900">
                  {lead.place_name ?? lead.place_id}
                </span>
                <span>{lead.rating ?? "—"}★</span>
                <span className="text-zinc-500">{formatDate(lead.review_date)}</span>
                <span className="truncate text-zinc-500">{lead.review_snippet ?? ""}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function ToastBanner({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{text}</div>
  );
}
