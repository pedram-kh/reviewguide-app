import { getStats, type StatsResponse } from "@/lib/api";

// Stats change every time a lead is touched — never serve a cached /admin render.
export const dynamic = "force-dynamic";

// LOGIC.md §3 lifecycle order, so the cards read left-to-right as a pipeline.
const STATUS_ORDER = [
  "new",
  "response_generated",
  "enriched",
  "queued",
  "sent",
  "replied",
  "converted",
  "dead",
] as const;

export default async function AdminPage() {
  let stats: StatsResponse | null = null;
  let error: string | null = null;

  try {
    stats = await getStats();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load stats";
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Admin dashboard</h1>
      <p className="mt-1 text-sm text-zinc-500">Live counts from the backend admin API.</p>

      {error || !stats ? (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load stats: {error ?? "unknown error"}
        </div>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Leads by status
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {STATUS_ORDER.map((status) => (
                <StatCard
                  key={status}
                  label={status.replaceAll("_", " ")}
                  value={stats.by_status[status] ?? 0}
                />
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Sending
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Sent today" value={stats.sent_today} highlight />
              <StatCard label="Replies" value={stats.replies} highlight />
              <StatCard
                label="Reply rate (G2 gate metric)"
                value={`${(stats.reply_rate * 100).toFixed(1)}%`}
                highlight
              />
              {Object.entries(stats.sent_by_channel).map(([channel, count]) => (
                <StatCard key={channel} label={`Sent via ${channel}`} value={count} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-lg border border-zinc-900 bg-zinc-900 p-4 text-white"
          : "rounded-lg border border-zinc-200 bg-white p-4"
      }
    >
      <p
        className={
          highlight ? "text-xs uppercase tracking-wide text-zinc-300" : "text-xs uppercase tracking-wide text-zinc-500"
        }
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
