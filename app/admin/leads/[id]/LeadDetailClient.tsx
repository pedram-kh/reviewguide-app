"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";

import { Icon } from "@/app/admin/icons";
import type { LeadDetail } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { canTransitionTo, explainWhyNotSendable } from "@/lib/leadTransitions";
import { MAX_SENDS_PER_DAY } from "@/lib/limits";
import { STATUS_BADGE } from "@/lib/statusStyle";
import { GLASS_CARD } from "@/lib/theme";

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
  sentToday,
}: {
  lead: LeadDetail;
  backHref: string;
  sentToday: number;
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

  // UAT-3 (3.4-UAT): fall back to a coordinates-based maps URL when google_maps_url is null
  // (e.g. a place discovered before this ticket that hasn't been re-polled yet).
  const mapsHref =
    lead.place.google_maps_url ??
    (lead.place.lat != null && lead.place.lng != null
      ? `https://www.google.com/maps?q=${lead.place.lat},${lead.place.lng}`
      : null);

  const canMarkSent = canTransitionTo(lead.status, "sent");
  const canSkip = canTransitionTo(lead.status, "dead");
  const healthBlocksSend = lead.health_flag && !healthReviewed;
  const dailyCapReached = sentToday >= MAX_SENDS_PER_DAY;
  const noChannelSelected = !channel;

  // UAT-1 (3.4-UAT): every disabled reason must be visible, not just a hover title — checked
  // in this order because an illegal transition or the daily cap make every other reason moot
  // (picking a channel or ticking the health box wouldn't unblock anything either way).
  const sendBlockedReason = !canMarkSent
    ? explainWhyNotSendable(lead.status)
    : dailyCapReached
      ? `Daily send cap reached (${MAX_SENDS_PER_DAY}/${MAX_SENDS_PER_DAY} sent today, LOGIC.md §6) — try again tomorrow.`
      : noChannelSelected
        ? "Select a channel below before marking sent."
        : healthBlocksSend
          ? "Tick \u201cI reviewed this response\u201d above before marking sent (health-flagged lead)."
          : null;
  const sendDisabled =
    !canMarkSent || dailyCapReached || noChannelSelected || healthBlocksSend || busy === "mark_sent";

  return (
    <div className="mt-4 space-y-8">
      <div className={`${GLASS_CARD} p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            {lead.place.name ?? lead.place.place_id}
          </h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[lead.status]}`}
          >
            {lead.status.replaceAll("_", " ")}
          </span>
          {lead.channel && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
              via {lead.channel}
            </span>
          )}
        </div>

        {(lead.place.rating != null || lead.place.address || mapsHref) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {lead.place.rating != null && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50/80 px-2.5 py-1 text-xs font-medium text-amber-700">
                ★ {lead.place.rating.toFixed(1)}
                {lead.place.reviews_count != null &&
                  ` · ${lead.place.reviews_count.toLocaleString()} reviews`}
              </span>
            )}
            {lead.place.address && (
              <span className="inline-flex items-center gap-1 text-sm text-zinc-600">
                <Icon name="map-pin" className="h-4 w-4 shrink-0 text-zinc-400" />
                {lead.place.address}
              </span>
            )}
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300/80 bg-white/60 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-white"
              >
                Open in Google Maps
              </a>
            )}
          </div>
        )}
      </div>

      {message && (
        <div
          className={
            message.kind === "success"
              ? "rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-2 text-sm text-emerald-700 backdrop-blur"
              : "rounded-2xl border border-red-200/70 bg-red-50/80 px-4 py-2 text-sm text-red-700 backdrop-blur"
          }
        >
          {message.text}
        </div>
      )}

      {lead.health_flag && (
        <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 backdrop-blur">
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
        <SectionLabel>Contact</SectionLabel>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lead.place.fb_url && (
            <ContactCard
              label="Facebook"
              value={facebookHandle(lead.place.fb_url)}
              copyValue={facebookHandle(lead.place.fb_url)}
              href={lead.place.fb_url}
              external
              actionLabel="Open"
              onCopied={() => flash("success", "Copied to clipboard.")}
            />
          )}
          {lead.place.email && (
            <ContactCard
              label="Email"
              value={lead.place.email}
              copyValue={lead.place.email}
              href={`mailto:${lead.place.email}`}
              actionLabel="Email"
              onCopied={() => flash("success", "Copied to clipboard.")}
            />
          )}
          {lead.place.phone && (
            <ContactCard
              label="Phone"
              value={lead.place.phone}
              copyValue={lead.place.phone}
              href={`tel:${lead.place.phone.replace(/[^+\d]/g, "")}`}
              actionLabel="Call"
              onCopied={() => flash("success", "Copied to clipboard.")}
            />
          )}
          {lead.place.website && (
            <ContactCard
              label="Website"
              value={stripProtocol(lead.place.website)}
              copyValue={lead.place.website}
              href={lead.place.website}
              external
              actionLabel="Visit"
              onCopied={() => flash("success", "Copied to clipboard.")}
            />
          )}
        </div>
        {!lead.place.fb_url && !lead.place.email && !lead.place.phone && !lead.place.website && (
          <p className="mt-2 text-sm text-zinc-400">No contact channels available for this place.</p>
        )}
      </section>

      <section>
        <SectionLabel>Review (read-only)</SectionLabel>
        <div className={`mt-2 ${GLASS_CARD} p-4 text-sm`}>
          <p className="text-zinc-500">
            {lead.review.rating ?? "—"}★ · {formatDate(lead.review.review_date)}
            {lead.review.author && <> · {lead.review.author}</>}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-zinc-900">{lead.review.text}</p>
        </div>
      </section>

      <EditableField
        label="Generated response"
        value={generatedResponse}
        onChange={setGeneratedResponse}
        onSave={() => saveField("generated_response", generatedResponse)}
        saving={busy === "generated_response"}
      />

      <EditableField
        label="Outreach message"
        value={outreachMessage}
        onChange={setOutreachMessage}
        onSave={() => saveField("outreach_message", outreachMessage)}
        saving={busy === "outreach_message"}
        extraActions={
          <button
            type="button"
            onClick={copyMessage}
            className="rounded-lg border border-zinc-300/80 bg-white/70 px-3 py-1.5 text-sm backdrop-blur hover:bg-white"
          >
            Copy message
          </button>
        }
      />

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
          className="mt-2 w-full rounded-lg border border-zinc-300/80 bg-white/70 p-3 text-sm backdrop-blur"
          placeholder="Free-text notes (autosaves)"
        />
      </section>

      <section className="border-t border-zinc-200/70 pt-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="mt-1 rounded-lg border border-zinc-300/80 bg-white/80 px-2 py-1.5 text-sm"
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
            disabled={sendDisabled}
            title={sendBlockedReason ?? undefined}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-40"
          >
            {dailyCapReached
              ? `Daily cap reached (${MAX_SENDS_PER_DAY}/${MAX_SENDS_PER_DAY})`
              : busy === "mark_sent"
                ? "Marking sent…"
                : "Mark sent"}
          </button>

          {canSkip && !showSkipConfirm && (
            <button
              type="button"
              onClick={() => setShowSkipConfirm(true)}
              className="rounded-lg border border-red-300/80 bg-white/70 px-4 py-2 text-sm font-medium text-red-700 backdrop-blur hover:bg-red-50"
            >
              Skip → dead
            </button>
          )}
        </div>
        {sendBlockedReason && <p className="mt-2 text-xs text-red-600">{sendBlockedReason}</p>}
      </section>

      {showSkipConfirm && (
        <section className="rounded-2xl border border-red-300/70 bg-red-50/80 p-4 backdrop-blur">
          <label className="block text-sm font-medium text-red-900">
            Note required — why are you abandoning this lead? (LOGIC.md §3)
          </label>
          <textarea
            value={skipNote}
            onChange={(e) => setSkipNote(e.target.value)}
            rows={2}
            className="mt-2 w-full rounded-lg border border-red-300/80 bg-white/70 p-2 text-sm"
            placeholder="e.g. business closed, wrong fit, duplicate lead"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirmSkip}
              disabled={busy === "skip"}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy === "skip" ? "Skipping…" : "Confirm skip → dead"}
            </button>
            <button
              type="button"
              onClick={() => setShowSkipConfirm(false)}
              className="rounded-lg border border-zinc-300/80 bg-white/70 px-4 py-2 text-sm"
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

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// UAT-2 (3.4-UAT): show the FB page name/slug rather than the raw URL as the card's headline value.
function facebookHandle(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    return path || stripProtocol(url);
  } catch {
    return stripProtocol(url);
  }
}

function ContactCard({
  label,
  value,
  copyValue,
  href,
  actionLabel,
  external = false,
  onCopied,
}: {
  label: string;
  value: string;
  copyValue: string;
  href: string;
  actionLabel: string;
  external?: boolean;
  onCopied: () => void;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue);
      onCopied();
    } catch {
      // Clipboard permission denial is rare and non-blocking here — the value is still visible
      // and selectable on the card, so silently skipping the toast is fine.
    }
  }

  return (
    <div className={`${GLASS_CARD} p-3 text-sm`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="rounded p-1 text-zinc-400 hover:bg-white hover:text-zinc-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M7 2a2 2 0 0 0-2 2v1H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H7Zm0 2h8v9h-1V7a2 2 0 0 0-2-2H7V4ZM4 7h8v9H4V7Z" />
          </svg>
        </button>
      </div>
      <p className="mt-1 truncate font-medium text-zinc-900" title={value}>
        {value}
      </p>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="mt-2 inline-block rounded-lg border border-zinc-300/80 bg-white/60 px-3 py-1 text-xs font-medium hover:bg-white"
      >
        {actionLabel}
      </a>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  onSave,
  saving,
  extraActions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  extraActions?: ReactNode;
}) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className="mt-2 w-full rounded-lg border border-zinc-300/80 bg-white/70 p-3 text-sm backdrop-blur"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {extraActions}
      </div>
    </section>
  );
}
