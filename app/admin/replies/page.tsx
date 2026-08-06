import { getLead, listLeads, type LeadListItem } from "@/lib/api";

import { ReplyRow, type ReplyRowData } from "./ReplyRow";

// The sent/replied set and the reply-rate math both change constantly — always fresh.
export const dynamic = "force-dynamic";

export default async function RepliesPage() {
  let rows: ReplyRowData[] = [];
  let error: string | null = null;

  try {
    // The 3.1 list endpoint doesn't expose sent_at or a sent_at sort (out of ticket 3.4's
    // backend scope, which only touches /stats and PATCH), so each row's full detail is
    // fetched to get sent_at and the list is sorted here. The sent+replied set is small
    // (bounded by the 20/day cap), so the extra per-row fetch is cheap.
    const [sent, replied]: LeadListItem[][] = await Promise.all([
      listLeads({ status: "sent" }),
      listLeads({ status: "replied" }),
    ]);
    const combined = [...sent, ...replied];
    const details = await Promise.all(combined.map((item) => getLead(item.lead_id)));

    rows = combined
      .map((item, index) => ({
        leadId: item.lead_id,
        status: item.status as "sent" | "replied",
        placeId: item.place_id,
        placeName: item.place_name,
        rating: item.rating,
        reviewSnippet: item.review_snippet,
        channel: item.channel,
        sentAt: details[index].sent_at,
      }))
      .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load replies";
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Replies</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Leads that have been sent and are awaiting or have received a reply, newest send first.
      </p>

      {error ? (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load replies: {error}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Nothing sent yet.</p>
      ) : (
        <div className="mt-6 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {rows.map((row) => (
            <ReplyRow key={row.leadId} {...row} />
          ))}
        </div>
      )}
    </main>
  );
}
