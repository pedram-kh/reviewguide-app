import Link from "next/link";
import { notFound } from "next/navigation";

import { BackendApiError, getRun, type PollRunDetail, type RunAlertItem } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { GLASS_CARD } from "@/lib/theme";

import { Accordion } from "../../Accordion";
import { runStatus } from "../runStatus";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let run: PollRunDetail | null = null;
  let loadError: string | null = null;
  try {
    run = await getRun(id);
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) notFound();
    loadError = err instanceof Error ? err.message : "Failed to load run";
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin/runs" className="text-sm text-zinc-500 underline hover:text-zinc-900">
        ← Back to runs
      </Link>

      {loadError || !run ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur">
          Couldn&apos;t load run {id}: {loadError}
        </div>
      ) : (
        <RunDetailView run={run} />
      )}
    </main>
  );
}

function RunDetailView({ run }: { run: PollRunDetail }) {
  const status = runStatus(run);
  const draftCount = run.customers.reduce((total, c) => total + c.alerts.length, 0);

  return (
    <div className="mt-6 flex flex-col gap-6">
      <section className={`${GLASS_CARD} p-6`}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            {formatDateTime(run.started_at)}
          </h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.badgeClass}`}>
            {status.label}
          </span>
          <span className="text-xs text-zinc-400">{run.trigger_source}</span>
        </div>
        {/* The id is here to be copied into a CloudWatch search: log lines for this run are
            prefixed poll-customers[<run_id>]. */}
        <p className="mt-1 font-mono text-xs text-zinc-400">{run.run_id}</p>

        {run.error_note && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50/70 p-3 text-sm text-red-700">
            {run.error_note}
          </p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Stat label="Finished" value={run.finished_at ? formatDateTime(run.finished_at) : "—"} />
          <Stat label="Customers polled" value={run.customers_polled} />
          <Stat label="Records fetched" value={run.records_fetched} />
          <Stat label="New drafts" value={run.new_alerts} />
          <Stat label="Emails sent" value={run.emails_sent} />
          <Stat label="Backfilled" value={run.backfilled} />
          <Stat label="Capped customers" value={run.skipped} alarming={run.skipped > 0} />
          <Stat label="Deferred drafts" value={run.deferred} alarming={run.deferred > 0} />
        </dl>
      </section>

      <section className={`${GLASS_CARD} p-6`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Per-customer breakdown ({draftCount} draft{draftCount === 1 ? "" : "s"})
        </h2>
        {run.customers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            This run produced no drafts. {run.customers_polled > 0 ? "It polled " : "It considered "}
            {run.customers_polled} customer{run.customers_polled === 1 ? "" : "s"} and found nothing
            new to respond to.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-6">
            {run.customers.map((customer, index) => {
              const urgentCount = customer.alerts.filter((alert) => alert.is_urgent).length;
              return (
                <Accordion
                  key={customer.customer_id}
                  defaultOpen={index === 0}
                  label={
                    <Link
                      href={`/admin/customers/${customer.customer_id}`}
                      className="font-medium text-zinc-900 underline decoration-zinc-300 hover:decoration-zinc-900"
                    >
                      {customer.email}
                    </Link>
                  }
                  meta={
                    <span className="text-sm text-zinc-500">
                      {customer.place_name ?? "—"} · {customer.alerts.length} draft
                      {customer.alerts.length === 1 ? "" : "s"}
                      {urgentCount > 0 && ` · ${urgentCount} PILNE`}
                    </span>
                  }
                >
                  {customer.alerts.map((alert) => (
                    <AlertCard key={alert.alert_id} alert={alert} />
                  ))}
                </Accordion>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function AlertCard({ alert }: { alert: RunAlertItem }) {
  return (
    <div className="rounded-xl border border-white/60 bg-white/50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        {alert.is_urgent && (
          <span className="rounded-full bg-red-100/80 px-2 py-0.5 font-medium text-red-700">
            PILNE
          </span>
        )}
        <span>{alert.review_rating ?? "—"}★</span>
        <span>{formatDateTime(alert.review_date)}</span>
        <span className="ml-auto">
          {alert.sent_at ? (
            `Emailed ${formatDateTime(alert.sent_at)}`
          ) : (
            // Not an error: a draft with no send is either deferred by the daily cap or waiting
            // on a failed send, and either way the next run's sweep is expected to deliver it.
            <span className="font-medium text-amber-700">Not emailed — awaiting sweep</span>
          )}
        </span>
      </div>
      {alert.review_text && <p className="mt-2 text-sm text-zinc-700">{alert.review_text}</p>}
      <p className="mt-2 rounded-lg bg-amber-50/70 p-3 text-sm whitespace-pre-wrap text-zinc-800">
        {alert.response_text}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  alarming = false,
}: {
  label: string;
  value: string | number;
  alarming?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className={`mt-0.5 ${alarming ? "font-medium text-red-700" : "text-zinc-900"}`}>
        {value}
      </dd>
    </div>
  );
}
