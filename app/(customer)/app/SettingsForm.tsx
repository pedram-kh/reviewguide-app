"use client";

import { useState } from "react";

import type { CustomerState } from "@/lib/customerApi";
import { readJson } from "@/lib/readJson";

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
      // This `catch` renders `err.message` straight to the customer, which is what made the
      // unguarded parse here the same latent bug 6.1 hit on connect: a non-JSON body would have put
      // a raw `SyntaxError` on screen. `readJson` guarantees the message is a sentence.
      const data = await readJson<CustomerState>(response, "Nie udało się zapisać ustawień.");
      onSaved(data);
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
      <label className="block text-xs text-ink-soft">Adres e-mail do powiadomień</label>
      <input
        type="email"
        value={notificationEmail}
        onChange={(event) => setNotificationEmail(event.target.value)}
        className="rg-input mt-1.5"
      />

      <label className="mt-4 block text-xs text-ink-soft">Ton odpowiedzi</label>
      <div className="mt-1.5 flex gap-2">
        {Object.entries(TONE_LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTonePreference(value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tonePreference === value
                ? // #3a2600 (not text-white — 2.07:1 on gold-deep, fails AA) matches btn-primary's
                  // dark-ink-on-gold text, computed at 6.96:1.
                  "bg-gold-deep text-[#3a2600]"
                : "border border-line text-ink-soft hover:border-gold-deep/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose-ink">
          {error}
        </p>
      )}

      <button type="button" onClick={handleSave} disabled={saving || !isDirty} className="btn btn-ghost mt-4">
        {saving ? "Zapisywanie…" : saved ? "Zapisano ✓" : "Zapisz ustawienia"}
      </button>
    </div>
  );
}
