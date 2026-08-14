/**
 * Ticket 6.6, part A — legal-links + company-info footer, rendered on every page of this repo
 * (root layout, below the customer/admin shell) since it's app.reviewguide.eu, not
 * reviewguide.eu: the four legal documents themselves are only published on the marketing
 * domain (see reviewguide-marketing/app/{regulamin,polityka-prywatnosci,cookies,dpa}), so these
 * are absolute cross-domain links rather than routes of this app.
 *
 * "Ustawienia cookies" points at the marketing site's Cookie Policy rather than reopening an
 * in-app banner — disclosed judgment call: this app itself sets no non-essential cookies (no
 * analytics here), so there is no consent banner to reopen here (see part D's report note).
 */
const LEGAL_BASE_URL = "https://reviewguide.eu";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white px-6 py-8 text-xs text-zinc-500">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <a href={`${LEGAL_BASE_URL}/regulamin`} className="hover:text-zinc-800 hover:underline">
            Regulamin
          </a>
          <a
            href={`${LEGAL_BASE_URL}/polityka-prywatnosci`}
            className="hover:text-zinc-800 hover:underline"
          >
            Polityka Prywatności
          </a>
          <a href={`${LEGAL_BASE_URL}/cookies`} className="hover:text-zinc-800 hover:underline">
            Polityka Cookies
          </a>
          <a href={`${LEGAL_BASE_URL}/dpa`} className="hover:text-zinc-800 hover:underline">
            DPA
          </a>
          <a href={`${LEGAL_BASE_URL}/cookies`} className="hover:text-zinc-800 hover:underline">
            Ustawienia cookies
          </a>
        </div>
        <p className="text-zinc-400">
          PEPE COMPANY sp. z o.o. · ul. Świętokrzyska 18/405, 00-052 Warszawa · NIP 5732861000 ·
          KRS 0000599316
        </p>
      </div>
    </footer>
  );
}
