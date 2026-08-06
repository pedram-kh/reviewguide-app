import Link from "next/link";
import type { ReactNode } from "react";

import { getStats } from "@/lib/api";
import { MAX_SENDS_PER_DAY } from "@/lib/limits";

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
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="font-semibold text-zinc-900">
              ReviewGuide
            </Link>
            <Link href="/admin" className="text-zinc-500 hover:text-zinc-900">
              Dashboard
            </Link>
            <Link href="/admin/leads" className="text-zinc-500 hover:text-zinc-900">
              Leads
            </Link>
            <Link href="/admin/replies" className="text-zinc-500 hover:text-zinc-900">
              Replies
            </Link>
          </nav>

          {sentToday !== null && (
            <span
              title="LOGIC.md §6: 10-20 messages/day maximum"
              className={
                atCap
                  ? "rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700"
                  : "rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600"
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
