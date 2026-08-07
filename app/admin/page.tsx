import { getStats, type StatsResponse } from "@/lib/api";
import { GLASS_CARD } from "@/lib/theme";

import { Icon, type IconName } from "./icons";

// Stats change every time a lead is touched — never serve a cached /admin render.
export const dynamic = "force-dynamic";

// LOGIC.md §3 lifecycle order, so the cards read left-to-right as a pipeline. Colors/icons are
// purely decorative (UAT-4, ticket 3.4-UAT) — same status set and counts as before.
const STATUS_STYLE: Record<string, { badge: string; icon: IconName }> = {
  new: { badge: "bg-slate-100 text-slate-600", icon: "circle" },
  response_generated: { badge: "bg-blue-100 text-blue-600", icon: "sparkle" },
  enriched: { badge: "bg-purple-100 text-purple-600", icon: "map-pin" },
  queued: { badge: "bg-amber-100 text-amber-600", icon: "clock" },
  sent: { badge: "bg-indigo-100 text-indigo-600", icon: "paper-plane" },
  replied: { badge: "bg-cyan-100 text-cyan-600", icon: "chat" },
  converted: { badge: "bg-emerald-100 text-emerald-600", icon: "check" },
  dead: { badge: "bg-rose-100 text-rose-600", icon: "x" },
};
const STATUS_ORDER = Object.keys(STATUS_STYLE) as (keyof typeof STATUS_STYLE)[];

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
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Admin dashboard</h1>
      <p className="mt-1 text-sm text-zinc-500">Live counts from the backend admin API.</p>

      {error || !stats ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur">
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
                  {...STATUS_STYLE[status]}
                />
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Sending
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Sent today"
                value={stats.sent_today}
                badge="bg-indigo-100 text-indigo-600"
                icon="paper-plane"
              />
              <StatCard
                label="Replies"
                value={stats.replies}
                badge="bg-cyan-100 text-cyan-600"
                icon="chat"
              />
              <StatCard
                label="Reply rate (G2 gate metric)"
                value={`${(stats.reply_rate * 100).toFixed(1)}%`}
                badge="bg-emerald-100 text-emerald-600"
                icon="chart-bar"
              />
              {Object.entries(stats.sent_by_channel).map(([channel, count]) => (
                <StatCard
                  key={channel}
                  label={`Sent via ${channel}`}
                  value={count}
                  badge="bg-teal-100 text-teal-600"
                  icon="envelope"
                />
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
  badge,
  icon,
}: {
  label: string;
  value: number | string;
  badge: string;
  icon: IconName;
}) {
  return (
    <div className={`${GLASS_CARD} p-4`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${badge}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase leading-tight tracking-wide text-zinc-500">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-semibold text-zinc-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
