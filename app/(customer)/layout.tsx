import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { DARK_PAGE_BACKGROUND } from "@/lib/theme";

/**
 * Shared dark shell for /signup, /login, /app (SPRINT_04.md ticket 4.2's dark-theme note — no
 * visible seam between reviewguide-marketing's landing and these pages). The `(customer)` route
 * group only affects the file layout, not the URL: these still resolve to /signup, /login, /app.
 */
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className={DARK_PAGE_BACKGROUND}>
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-5">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            {/* Ticket 6.7 — /brand/mark.png (transparent) instead of /icon-192.png (opaque white
                background, per the marketing repo's asset pipeline): this header sits on the dark
                theme (DARK_PAGE_BACKGROUND, bg-black), and a white-padded icon would show as a
                visible white square/circle behind the mark instead of blending in. */}
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
