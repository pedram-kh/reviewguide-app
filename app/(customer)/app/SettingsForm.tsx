"use client";

import { useState } from "react";

import type { CustomerState } from "@/lib/customerApi";

const TONE_LABELS: Record<string, string> = {
  formal: "Formalny",
  friendly: "Przyjazny",
};

const SAVED_FEEDBACK_MS = 2500;

/**
 * Ticket 5.3's settings section: notification email (default = login email, editable) and tone
 * preference (formal/friendly, LOGIC.md §8a — feeds the generation prompt).
 */
export function SettingsForm({
  state,
  onSaved,
}: {
  state: CustomerState;
  onSaved: (state: CustomerState) => void;
}) {
  const [notificationEmail, setNotificationEmail] = useState(state.notification_email ?? state.email);
  const [tonePreference, setTonePreference] = useState(state.tone_preference);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty =
    notificationEmail !== (state.notification_email ?? state.email) || tonePreference !== state.tone_preference;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/customer/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_email: notificationEmail, tone_preference: tonePreference }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.detail === "string" ? data.detail : "Nie udało się zapisać ustawień.");
      }
      onSaved(data as CustomerState);
      setSaved(true);
      setTimeout(() => setSaved(false), SAVED_FEEDBACK_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać ustawień.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label className="block text-xs text-white/50">Adres e-mail do powiadomień</label>
      <input
        type="email"
        value={notificationEmail}
        onChange={(event) => setNotificationEmail(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
      />

      <label className="mt-4 block text-xs text-white/50">Ton odpowiedzi</label>
      <div className="mt-1.5 flex gap-2">
        {Object.entries(TONE_LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTonePreference(value)}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              tonePreference === value
                ? "bg-white text-black"
                : "border border-white/15 text-white/70 hover:border-white/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !isDirty}
        className="mt-4 rounded-full border border-white/15 px-4 py-2 text-sm text-white transition-colors hover:border-white/30 disabled:opacity-40"
      >
        {saving ? "Zapisywanie…" : saved ? "Zapisano ✓" : "Zapisz ustawienia"}
      </button>
    </div>
  );
}
