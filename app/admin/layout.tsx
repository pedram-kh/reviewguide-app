import Link from "next/link";
import type { ReactNode } from "react";

import { getStats } from "@/lib/api";
import { MAX_SENDS_PER_DAY } from "@/lib/limits";
import { GLASS_NAV, PAGE_BACKGROUND } from "@/lib/theme";

// The sends-today counter must reflect the live count on every navigation.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let sentToday: number | null = null;
  try {
    sentToday = (await getStats()).sent_today;
  } catch {
    sentToday = null; // Individual pages surface their own load errors; the header just hides the counter.
  }

  const atCap = sentToday !== null && sentToday >= MAX_SENDS_PER_DAY;

  return (
    <div className={PAGE_BACKGROUND}>
      <header className={`sticky top-0 z-10 ${GLASS_NAV}`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/admin" className="font-semibold tracking-tight text-zinc-900">
              ReviewGuide
            </Link>
            <Link href="/admin" className="text-zinc-500 transition-colors hover:text-zinc-900">
              Dashboard
            </Link>
            <Link href="/admin/leads" className="text-zinc-500 transition-colors hover:text-zinc-900">
              Leads
            </Link>
            <Link href="/admin/replies" className="text-zinc-500 transition-colors hover:text-zinc-900">
              Replies
            </Link>
            <Link
              href="/admin/customers"
              className="text-zinc-500 transition-colors hover:text-zinc-900"
            >
              Customers
            </Link>
            <Link href="/admin/runs" className="text-zinc-500 transition-colors hover:text-zinc-900">
              Runs
            </Link>
          </nav>

          {sentToday !== null && (
            <span
              title="LOGIC.md §6: 10-20 messages/day maximum"
              className={
                atCap
                  ? "rounded-full border border-red-200/70 bg-red-100/80 px-3 py-1 text-xs font-medium text-red-700"
                  : "rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-600"
              }
            >
              Sent today: {sentToday}/{MAX_SENDS_PER_DAY}
            </span>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
