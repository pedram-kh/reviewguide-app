"use client";

import { useState } from "react";

const COPY_FEEDBACK_MS = 2000;

/**
 * Ticket 6.9 — every /app copy control: gold primary at rest, filled green + "Skopiowano ✓"
 * for ~2s on success. The green fill is `--green-ink` (#0e7a4a) + white (5.38:1), not the
 * landing's `--green` (#1fb872) which is 2.57:1 with white and would fail AA.
 */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard permission denied or unavailable (rare, but not worth surfacing as an error —
      // the text is already selectable/visible for a manual copy).
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      data-copied={copied ? "true" : "false"}
      className={`btn btn-copy ${copied ? "btn-copied" : "btn-primary"}`}
    >
      {copied ? "Skopiowano ✓" : "Kopiuj"}
    </button>
  );
}
