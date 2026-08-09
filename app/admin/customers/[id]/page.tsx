import Link from "next/link";
import { notFound } from "next/navigation";

import { BackendApiError, getCustomer, type CustomerDetail } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { GLASS_CARD } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) notFound();

  let customer: CustomerDetail | null = null;
  let loadError: string | null = null;
  try {
    customer = await getCustomer(customerId);
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) notFound();
    loadError = err instanceof Error ? err.message : "Failed to load customer";
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin/customers" className="text-sm text-zinc-500 underline hover:text-zinc-900">
        ← Back to customers
      </Link>

      {loadError || !customer ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur">
          Couldn&apos;t load customer {customerId}: {loadError}
        </div>
      ) : (
        <CustomerDetailView customer={customer} />
      )}
    </main>
  );
}

function CustomerDetailView({ customer }: { customer: CustomerDetail }) {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <section className={`${GLASS_CARD} p-6`}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{customer.email}</h1>
          {customer.is_test && (
            <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
              test account
            </span>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Field label="Notification email" value={customer.notification_email ?? "—"} />
          <Field label="Tone preference" value={customer.tone_preference} />
          <Field label="Subscription" value={customer.subscription_status} />
          <Field label="Account created" value={formatDateTime(customer.created_at)} />
          <Field label="Connected at" value={formatDateTime(customer.connected_at)} />
        </dl>
      </section>

      <section className={`${GLASS_CARD} p-6`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Connected restaurant
        </h2>
        {customer.place ? (
          <div className="mt-3 text-sm">
            <p className="font-medium text-zinc-900">{customer.place.name ?? customer.place.place_id}</p>
            <p className="mt-1 text-zinc-500">{customer.place.address ?? "—"}</p>
            <p className="mt-1 text-zinc-500">
              Rating: {customer.place.rating ?? "—"}★ · Last checked:{" "}
              {formatDateTime(customer.place.last_polled_at)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Not connected to a restaurant yet.</p>
        )}
      </section>

      {customer.recent_delivery_statuses.length > 0 && (
        <section className={`${GLASS_CARD} p-6`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Postmark delivery — last {customer.recent_delivery_statuses.length} sent alerts
          </h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {customer.recent_delivery_statuses.map((item) => (
              <li key={item.postmark_message_id} className="flex items-center gap-2 text-zinc-600">
                <span className="font-mono text-xs text-zinc-400">
                  {item.postmark_message_id.slice(0, 8)}…
                </span>
                <span
                  className={
                    item.status
                      ? "rounded-full bg-emerald-100/80 px-2 py-0.5 text-xs font-medium text-emerald-700"
                      : "rounded-full bg-zinc-100/80 px-2 py-0.5 text-xs font-medium text-zinc-500"
                  }
                >
                  {item.status ?? "unknown"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${GLASS_CARD} p-6`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Alert history ({customer.alerts.length})
        </h2>
        {customer.alerts.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No alerts generated yet.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {customer.alerts.map((alert) => (
              <div key={alert.alert_id} className="rounded-xl border border-white/60 bg-white/50 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="rounded-full bg-zinc-100/80 px-2 py-0.5 font-medium">
                    {alert.kind}
                  </span>
                  {alert.is_urgent && (
                    <span className="rounded-full bg-red-100/80 px-2 py-0.5 font-medium text-red-700">
                      PILNE
                    </span>
                  )}
                  <span>{alert.review_rating ?? "—"}★</span>
                  <span>{formatDateTime(alert.review_date)}</span>
                  <span className="ml-auto">
                    {alert.sent_at ? `Sent ${formatDateTime(alert.sent_at)}` : "Not sent"}
                  </span>
                  {alert.generation_stop_reason && (
                    <span className="font-mono">stop: {alert.generation_stop_reason}</span>
                  )}
                </div>
                {alert.review_text && (
                  <p className="mt-2 text-sm text-zinc-700">{alert.review_text}</p>
                )}
                <p className="mt-2 rounded-lg bg-amber-50/70 p-3 text-sm whitespace-pre-wrap text-zinc-800">
                  {alert.response_text}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-zinc-900">{value}</dd>
    </div>
  );
}
