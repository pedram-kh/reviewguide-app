import Link from "next/link";

import { listCustomers, type CustomerListItem } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { GLASS_CARD } from "@/lib/theme";

// Subscription status / last-alert time must always reflect the live count — never a stale cache.
export const dynamic = "force-dynamic";

const GRID_COLS = "grid grid-cols-[2fr_1.6fr_1fr_1fr_1fr]";

const STATUS_BADGE: Record<string, string> = {
  trialing: "bg-amber-100/80 text-amber-700",
  active: "bg-emerald-100/80 text-emerald-700",
  none: "bg-zinc-100/80 text-zinc-500",
  past_due: "bg-red-100/80 text-red-700",
  canceled: "bg-zinc-100/80 text-zinc-500",
};

function statusBadgeClass(status: string): string {
  return STATUS_BADGE[status] ?? "bg-zinc-100/80 text-zinc-500";
}

export default async function CustomersPage() {
  let customers: CustomerListItem[] = [];
  let error: string | null = null;
  try {
    customers = await listCustomers();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load customers";
  }

  // The headline number people actually act on. Test rows stay listed below, just not counted
  // as traction — see migration 007.
  const testCount = customers.filter((customer) => customer.is_test).length;
  const realCount = customers.length - testCount;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Customers</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Read-only view of System B (the customer product) — connect status, subscription, and
        last alert per account.
      </p>
      {customers.length > 0 && (
        <p className="mt-2 text-sm text-zinc-600">
          <span className="font-medium text-zinc-900">{realCount} real</span>
          {testCount > 0 && <span className="text-zinc-400"> · {testCount} test</span>}
        </p>
      )}

      {error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur">
          Couldn&apos;t load customers: {error}
        </div>
      ) : customers.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No customers yet.</p>
      ) : (
        <div className={`mt-6 overflow-hidden ${GLASS_CARD}`}>
          <div
            className={`${GRID_COLS} gap-3 border-b border-white/60 bg-white/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500`}
          >
            <span>Email</span>
            <span>Restaurant</span>
            <span>Status</span>
            <span>Connected</span>
            <span>Last alert</span>
          </div>
          <div className="divide-y divide-white/50">
            {customers.map((customer) => (
              <Link
                key={customer.customer_id}
                href={`/admin/customers/${customer.customer_id}`}
                className={`${GRID_COLS} items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/60`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-zinc-900">{customer.email}</span>
                  {customer.is_test && (
                    <span className="shrink-0 rounded-full bg-zinc-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                      test
                    </span>
                  )}
                </span>
                <span className="truncate text-zinc-500">{customer.place_name ?? "—"}</span>
                <span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(customer.subscription_status)}`}
                  >
                    {customer.subscription_status}
                  </span>
                </span>
                <span className="text-zinc-500">{formatDateTime(customer.connected_at)}</span>
                <span className="text-zinc-500">{formatDateTime(customer.last_alert_at)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
