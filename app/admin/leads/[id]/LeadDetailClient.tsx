"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";

import type { LeadDetail } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { canTransitionTo } from "@/lib/leadTransitions";

const CHANNELS = ["facebook", "email", "contact_form"] as const;
const NOTES_AUTOSAVE_DELAY_MS = 800;

async function patchLead(leadId: number, body: Record<string, unknown>): Promise<LeadDetail> {
  const response = await fetch(`/api/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error((data as { detail?: string }).detail ?? `Request failed (${response.status})`);
  }
  return data as LeadDetail;
}

export function LeadDetailClient({
  lead: initialLead,
  backHref,
}: {
  lead: LeadDetail;
  backHref: string;
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [generatedResponse, setGeneratedResponse] = useState(initialLead.generated_response ?? "");
  const [outreachMessage, setOutreachMessage] = useState(initialLead.outreach_message ?? "");
  const [notes, setNotes] = useState(initialLead.notes ?? "");
  const [channel, setChannel] = useState(initialLead.channel ?? "");
  const [healthReviewed, setHealthReviewed] = useState(false);
  const [skipNote, setSkipNote] = useState(initialLead.notes ?? "");
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [notesSaveState, setNotesSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(kind: "success" | "error", text: string) {
    setMessage({ kind, text });
    setTimeout(() => setMessage((current) => (current?.text === text ? null : current)), 4000);
  }

  function returnToList(toast: "sent" | "skipped") {
    const params = new URLSearchParams(backHref.split("?")[1] ?? "");
    params.set("toast", toast);
    router.push(`/admin/leads?${params.toString()}`);
  }

  async function saveField(field: "generated_response" | "outreach_message", value: string) {
    setBusy(field);
    try {
      const updated = await patchLead(lead.lead_id, { [field]: value });
      setLead(updated);
      flash("success", "Saved.");
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    setNotesSaveState("saving");
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(async () => {
      try {
        const updated = await patchLead(lead.lead_id, { notes: value });
        setLead(updated);
        setNotesSaveState("saved");
      } catch {
        setNotesSaveState("error");
      }
    }, NOTES_AUTOSAVE_DELAY_MS);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(outreachMessage);
      flash("success", "Copied to clipboard.");
    } catch {
      flash("error", "Clipboard copy failed — select and copy manually.");
    }
  }

  async function markSent() {
    if (!channel) {
      flash("error", "Pick a channel first.");
      return;
    }
    setBusy("mark_sent");
    try {
      await patchLead(lead.lead_id, {
        status: "sent",
        channel,
        ...(lead.health_flag ? { confirm_health_reviewed: healthReviewed } : {}),
      });
      returnToList("sent");
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Failed to mark as sent");
      setBusy(null);
    }
  }

  async function confirmSkip() {
    if (!skipNote.trim()) {
      flash("error", "A note is required to skip this lead (LOGIC.md §3).");
      return;
    }
    setBusy("skip");
    try {
      await patchLead(lead.lead_id, { status: "dead", notes: skipNote });
      returnToList("skipped");
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Failed to skip lead");
      setBusy(null);
    }
  }

  const canMarkSent = canTransitionTo(lead.status, "sent");
  const canSkip = canTransitionTo(lead.status, "dead");
  const healthBlocksSend = lead.health_flag && !healthReviewed;

  return (
    <div className="mt-4 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          {lead.place.name ?? lead.place.place_id}
        </h1>
        <p className="text-sm text-zinc-500">
          Status: <span className="font-medium">{lead.status.replaceAll("_", " ")}</span>
          {lead.channel && <> · Channel: {lead.channel}</>}
        </p>
      </div>

      {message && (
        <div
          className={
            message.kind === "success"
              ? "rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700"
              : "rounded-md bg-red-50 px-4 py-2 text-sm text-red-700"
          }
        >
          {message.text}
        </div>
      )}

      {lead.health_flag && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">⚠ Health/safety flagged review</p>
          <p className="mt-1 text-sm text-amber-800">
            Review the generated response carefully before sending — never auto-send (LOGIC.md §2).
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={healthReviewed}
              onChange={(e) => setHealthReviewed(e.target.checked)}
            />
            I reviewed this response
          </label>
        </div>
      )}

      <section>
        <SectionLabel>Review (read-only)</SectionLabel>
        <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <p className="text-zinc-500">
            {lead.review.rating ?? "—"}★ · {formatDate(lead.review.review_date)}
            {lead.review.author && <> · {lead.review.author}</>}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-zinc-900">{lead.review.text}</p>
        </div>
      </section>

      <section>
        <SectionLabel>Contact</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          <ContactButton href={lead.place.fb_url ?? undefined} label="Facebook" />
          <ContactButton
            href={lead.place.email ? `mailto:${lead.place.email}` : undefined}
            label="Email"
          />
          <ContactButton href={lead.place.phone ? `tel:${lead.place.phone}` : undefined} label="Call" />
          <ContactButton href={lead.place.website ?? undefined} label="Website" />
        </div>
      </section>

      <EditableField
        label="Generated response"
        value={generatedResponse}
        onChange={setGeneratedResponse}
        onSave={() => saveField("generated_response", generatedResponse)}
        saving={busy === "generated_response"}
      />

      <section>
        <EditableField
          label="Outreach message"
          value={outreachMessage}
          onChange={setOutreachMessage}
          onSave={() => saveField("outreach_message", outreachMessage)}
          saving={busy === "outreach_message"}
        />
        <button
          type="button"
          onClick={copyMessage}
          className="mt-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          Copy message
        </button>
      </section>

      <section>
        <SectionLabel>
          Notes
          {notesSaveState === "saving" && " (saving…)"}
          {notesSaveState === "saved" && " (saved)"}
          {notesSaveState === "error" && " (save failed)"}
        </SectionLabel>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-lg border border-zinc-300 p-3 text-sm"
          placeholder="Free-text notes (autosaves)"
        />
      </section>

      <section className="flex flex-wrap items-end gap-4 border-t border-zinc-200 pt-6">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Channel
          </label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="mt-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Select channel…</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={markSent}
          disabled={!canMarkSent || healthBlocksSend || busy === "mark_sent"}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          title={
            !canMarkSent
              ? `Cannot mark 'sent' from status '${lead.status}' (LOGIC.md §3)`
              : healthBlocksSend
                ? "Confirm you reviewed the health-flagged response first"
                : undefined
          }
        >
          {busy === "mark_sent" ? "Marking sent…" : "Mark sent"}
        </button>

        {canSkip && !showSkipConfirm && (
          <button
            type="button"
            onClick={() => setShowSkipConfirm(true)}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Skip → dead
          </button>
        )}
      </section>

      {showSkipConfirm && (
        <section className="rounded-lg border border-red-300 bg-red-50 p-4">
          <label className="block text-sm font-medium text-red-900">
            Note required — why are you abandoning this lead? (LOGIC.md §3)
          </label>
          <textarea
            value={skipNote}
            onChange={(e) => setSkipNote(e.target.value)}
            rows={2}
            className="mt-2 w-full rounded-md border border-red-300 p-2 text-sm"
            placeholder="e.g. business closed, wrong fit, duplicate lead"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirmSkip}
              disabled={busy === "skip"}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy === "skip" ? "Skipping…" : "Confirm skip → dead"}
            </button>
            <button
              type="button"
              onClick={() => setShowSkipConfirm(false)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{children}</h2>
  );
}

function ContactButton({ href, label }: { href?: string; label: string }) {
  if (!href) {
    return (
      <span className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-300">
        {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
    >
      {label}
    </a>
  );
}

function EditableField({
  label,
  value,
  onChange,
  onSave,
  saving,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className="mt-2 w-full rounded-lg border border-zinc-300 p-3 text-sm"
      />
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="mt-2 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </section>
  );
}
