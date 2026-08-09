"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatDateTime } from "@/lib/format";
import { readJson, UNEXPECTED_RESPONSE_EN } from "@/lib/readJson";

export interface ReplyRowData {
  leadId: number;
  status: "sent" | "replied";
  placeId: string;
  placeName: string | null;
  rating: number | null;
  reviewSnippet: string | null;
  channel: string | null;
  sentAt: string | null;
}

async function patchLead(leadId: number, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`/api/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await readJson<unknown>(response, `Request failed (${response.status})`, UNEXPECTED_RESPONSE_EN);
}

export function ReplyRow({ leadId, status, placeId, placeName, rating, reviewSnippet, channel, sentAt }: ReplyRowData) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeadConfirm, setShowDeadConfirm] = useState(false);
  const [deadNote, setDeadNote] = useState("");

  async function run(action: string, body: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    try {
      await patchLead(leadId, body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function confirmDead() {
    if (!deadNote.trim()) {
      setError("A note is required to mark this lead dead (LOGIC.md §3).");
      return;
    }
    await run("dead", { status: "dead", notes: deadNote });
    setShowDeadConfirm(false);
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={`/admin/leads/${leadId}`} className="font-medium text-zinc-900 hover:underline">
          {placeName ?? placeId}
        </Link>
        <p className="truncate text-sm text-zinc-500">
          {rating ?? "—"}★ · {channel ?? "no channel"} · sent {formatDateTime(sentAt)} · currently{" "}
          {status}
        </p>
        {reviewSnippet && <p className="mt-1 truncate text-sm text-zinc-400">{reviewSnippet}</p>}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {status === "sent" && (
          <button
            type="button"
            onClick={() => run("replied", { status: "replied" })}
            disabled={busy !== null}
            className="rounded-lg border border-zinc-300/80 bg-white/70 px-3 py-1.5 text-sm backdrop-blur hover:bg-white disabled:opacity-40"
          >
            {busy === "replied" ? "Marking…" : "Mark replied"}
          </button>
        )}
        {status === "replied" && (
          <button
            type="button"
            onClick={() => run("converted", { status: "converted" })}
            disabled={busy !== null}
            className="rounded-lg border border-emerald-300/80 bg-white/70 px-3 py-1.5 text-sm text-emerald-700 backdrop-blur hover:bg-emerald-50 disabled:opacity-40"
          >
            {busy === "converted" ? "Marking…" : "Mark converted"}
          </button>
        )}

        {!showDeadConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeadConfirm(true)}
            disabled={busy !== null}
            className="rounded-lg border border-red-300/80 bg-white/70 px-3 py-1.5 text-sm text-red-700 backdrop-blur hover:bg-red-50 disabled:opacity-40"
          >
            Mark dead
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={deadNote}
              onChange={(e) => setDeadNote(e.target.value)}
              placeholder="Why? (required)"
              className="rounded-lg border border-red-300/80 bg-white/80 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={confirmDead}
              disabled={busy !== null}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy === "dead" ? "Marking…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeadConfirm(false)}
              className="text-sm text-zinc-500"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
