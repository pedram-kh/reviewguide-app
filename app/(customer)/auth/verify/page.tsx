import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DARK_GLASS_CARD } from "@/lib/theme";

import { VerifySubmitButton } from "./VerifySubmitButton";

export const metadata: Metadata = { title: "Dokończ logowanie — ReviewGuide" };

/**
 * Interstitial verify step (SPRINT_04.md ticket 4.2b). This GET route intentionally never touches
 * the backend's token-consuming endpoint — it only renders a page and echoes the token back into a
 * hidden form field. Consumption happens on POST /api/auth/complete-verify, which only a human
 * submitting the button below (or a scanner that also executes forms/JS, which none observed in
 * practice do) can trigger. This is what makes a plain GET here safe to hit any number of times,
 * including by a mailbox provider's automated link-prescanning.
 *
 * The submit button (VerifySubmitButton) is a small client component purely for a disabled/
 * pending UI state (ticket 4.5 double-submit fix) — it makes no network call of its own; the
 * form's own POST navigation to /api/auth/complete-verify is unchanged.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login?error=missing_token");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className={`${DARK_GLASS_CARD} mx-auto max-w-md p-8 text-center`}>
        <h1 className="text-2xl font-semibold text-white">Kliknij, aby dokończyć logowanie</h1>
        <p className="mt-3 text-sm text-white/70">
          Ze względów bezpieczeństwa link z e-maila nie loguje Cię automatycznie — potwierdź
          poniżej.
        </p>
        <form action="/api/auth/complete-verify" method="POST" className="mt-6">
          <input type="hidden" name="token" value={token} />
          <VerifySubmitButton />
        </form>
      </div>
    </div>
  );
}
