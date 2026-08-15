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
 *
 * Grouped/labelled layout mirrors reviewguide-marketing's <SiteFooter> so the two domains read as
 * one product. Text colours are zinc-600/700 rather than the zinc-400/500 this started with: the
 * registration block at zinc-400 was 2.56:1 on white, well under WCAG AA's 4.5:1.
 */
const LEGAL_BASE_URL = "https://reviewguide.eu";

const LEGAL_LINKS = [
  { href: `${LEGAL_BASE_URL}/regulamin`, label: "Regulamin" },
  { href: `${LEGAL_BASE_URL}/polityka-prywatnosci`, label: "Polityka Prywatności" },
  { href: `${LEGAL_BASE_URL}/cookies`, label: "Polityka Cookies" },
  { href: `${LEGAL_BASE_URL}/dpa`, label: "DPA" },
];

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div>
            <h2 className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.09em] text-amber-700">
              Dokumenty
            </h2>
            <ul className="flex flex-col gap-2 text-sm font-medium text-zinc-600">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="rounded hover:text-zinc-900 hover:underline hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="sm:text-right">
            <h2 className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.09em] text-amber-700">
              Dane rejestrowe
            </h2>
            <address className="flex flex-col gap-0.5 text-[0.82rem] not-italic text-zinc-600">
              <span className="font-semibold text-zinc-900">PEPE COMPANY sp. z o.o.</span>
              <span>ul. Świętokrzyska 18/405, 00-052 Warszawa</span>
              <span>NIP 5732861000 · KRS 0000599316</span>
            </address>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.82rem] font-medium text-zinc-600">
            © {new Date().getFullYear()} ReviewGuide
          </p>
          <a
            href={`${LEGAL_BASE_URL}/cookies`}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-[0.82rem] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d="M12 3a9 9 0 109 9 4.2 4.2 0 01-5-5 4.2 4.2 0 01-4-4z" strokeLinejoin="round" />
              <path d="M9 10h.01M13 14h.01M8.5 15h.01" strokeLinecap="round" strokeWidth={2.6} />
            </svg>
            Ustawienia cookies
          </a>
        </div>
      </div>
    </footer>
  );
}
