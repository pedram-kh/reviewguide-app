import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { CUSTOMER_NAV, CUSTOMER_PAGE_BACKGROUND } from "@/lib/theme";

/**
 * Shared cream/gold shell for /signup, /login, /app (ticket 6.8 — re-themed from the dark shell
 * SPRINT_04.md ticket 4.2 originally shipped, to follow the landing's 6.5 cream/gold redesign; see
 * lib/theme.ts's CUSTOMER_PAGE_BACKGROUND comment). The `(customer)` route group only affects the
 * file layout, not the URL: these still resolve to /signup, /login, /app.
 */
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className={CUSTOMER_PAGE_BACKGROUND}>
      <header className={CUSTOMER_NAV}>
        <div className="mx-auto flex max-w-5xl items-center px-6 py-5">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
            {/* Ticket 6.7 kept /brand/mark.png (transparent) for the dark shell; ticket 6.8's cream
                background no longer needs that — /icon-192.png's opaque-white composite would now
                blend in fine — but mark.png still renders identically on cream (it's the same
                gold-star art either way), so there is no reason to touch this. */}
            <Image
              src="/brand/mark.png"
              alt=""
              width={28}
              height={28}
              aria-hidden="true"
            />
            ReviewGuide
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
