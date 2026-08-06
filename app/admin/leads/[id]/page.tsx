import Link from "next/link";
import { notFound } from "next/navigation";

import { BackendApiError, getLead, getStats, type LeadDetail } from "@/lib/api";

import { LeadDetailClient } from "./LeadDetailClient";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const leadId = Number(id);

  if (!Number.isInteger(leadId)) notFound();

  const backHref = `/admin/leads${from ? `?${from}` : ""}`;

  let lead: LeadDetail | null = null;
  let loadError: string | null = null;
  let sentToday = 0;
  try {
    lead = await getLead(leadId);
    // Best-effort: if stats fail to load, fall back to 0 rather than blocking the whole page —
    // the backend's own 429 on the PATCH is still the real enforcement point either way.
    sentToday = (await getStats()).sent_today;
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) notFound();
    if (!lead) loadError = err instanceof Error ? err.message : "Failed to load lead";
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href={backHref} className="text-sm text-zinc-500 underline">
        ← Back to leads
      </Link>

      {loadError || !lead ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load lead {leadId}: {loadError}
        </div>
      ) : (
        <LeadDetailClient lead={lead} backHref={backHref} sentToday={sentToday} />
      )}
    </main>
  );
}
