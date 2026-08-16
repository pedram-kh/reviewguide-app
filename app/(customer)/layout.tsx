import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { CUSTOMER_NAV, CUSTOMER_PAGE_BACKGROUND } from "@/lib/theme";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

import { AccountMenu } from "./AccountMenu";

/**
 * Shared cream/gold shell for /signup, /login, /app (ticket 6.8 — re-themed from the dark shell
 * SPRINT_04.md ticket 4.2 originally shipped, to follow the landing's 6.5 cream/gold redesign; see
 * lib/theme.ts's CUSTOMER_PAGE_BACKGROUND comment). Ticket 6.9 makes the header sticky (landing
 * language: logo left) and adds the account menu on the right when a session is present.
 * The `(customer)` route group only affects the file layout, not the URL.
 */
export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  return (
    <div className={CUSTOMER_PAGE_BACKGROUND}>
      <header className={CUSTOMER_NAV}>
        <div className="mx-auto flex h-[74px] max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 text-[1.2rem] font-extrabold tracking-tight text-ink">
            {/* Ticket 6.7 kept /brand/mark.png (transparent) for the dark shell; ticket 6.8's cream
                background no longer needs that — /icon-192.png's opaque-white composite would now
                blend in fine — but mark.png still renders identically on cream (it's the same
                gold-star art either way), so there is no reason to touch this. Sized to the
                landing's 38px mark (ticket 6.9 "consistent with the landing's language"). */}
            <Image
              src="/brand/mark.png"
              alt=""
              width={38}
              height={38}
              aria-hidden="true"
            />
            ReviewGuide
          </Link>
          {session ? <AccountMenu email={session.email} /> : null}
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
