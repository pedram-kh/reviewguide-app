import Link from "next/link";

import { listRuns, type PollRunListItem } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { GLASS_CARD } from "@/lib/theme";
import { runStatus } from "./runStatus";

// A run that finished thirty seconds ago must show up on the next page load, never from a cache.
export const dynamic = "force-dynamic";

const GRID_COLS = "grid grid-cols-[1.5fr_0.8fr_repeat(6,0.6fr)_1fr]";

export default async function RunsPage() {
  let runs: PollRunListItem[] = [];
  let error: string | null = null;
  try {
    runs = await listRuns();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load runs";
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Poll runs</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Every execution of the 2-hourly poller — what it fetched, drafted, and sent. Newest first.
      </p>

      {error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur">
          Couldn&apos;t load runs: {error}
        </div>
      ) : runs.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          No runs recorded yet. Runs are recorded from migration 010 onwards — anything before that
          exists only in CloudWatch.
        </p>
      ) : (
        <div className={`mt-6 overflow-hidden ${GLASS_CARD}`}>
          <div
            className={`${GRID_COLS} gap-3 border-b border-white/60 bg-white/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500`}
          >
            <span>Started</span>
            <span>Trigger</span>
            <span title="Customers polled">Cust.</span>
            <span title="Review records fetched from Outscraper">Fetched</span>
            <span title="New drafts created">Alerts</span>
            <span title="Emails actually delivered">Emails</span>
            <span title="Previously-stuck drafts delivered by the sweep">Backfill</span>
            <span title="Customers that hit the daily email cap">Skipped</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-white/50">
            {runs.map((run) => {
              const status = runStatus(run);
              return (
                <Link
                  key={run.run_id}
                  href={`/admin/runs/${run.run_id}`}
                  className={`${GRID_COLS} items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    status.alarming ? "bg-red-50/70 hover:bg-red-50" : "hover:bg-white/60"
                  }`}
                >
                  <span className="text-zinc-900">{formatDateTime(run.started_at)}</span>
                  <span className="text-zinc-500">{run.trigger_source}</span>
                  <Count value={run.customers_polled} />
                  <Count value={run.records_fetched} />
                  <Count value={run.new_alerts} />
                  <Count value={run.emails_sent} />
                  <Count value={run.backfilled} />
                  <Count value={run.skipped} alarming={run.skipped > 0} />
                  <span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.badgeClass}`}
                    >
                      {status.label}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

function Count({ value, alarming = false }: { value: number; alarming?: boolean }) {
  // Zeroes are greyed out so a scan down the column picks out the runs that did something. Most
  // runs legitimately do nothing at all, and rows of black zeroes make the busy ones hard to spot.
  return (
    <span
      className={
        alarming ? "font-medium text-red-700" : value === 0 ? "text-zinc-300" : "text-zinc-700"
      }
    >
      {value}
    </span>
  );
}
