"use client";

import { useState } from "react";

import type { DayGroup } from "@/lib/alertGroups";
import type { AlertItem } from "@/lib/customerApi";
import { formatDatePl } from "@/lib/format";

import { AlertsList } from "./AlertsList";

/**
 * Ticket 6.9 Historia tab: one row per Warsaw day that produced alerts. Click expands inline
 * to that day's review+response cards (the existing AlertsList, not /admin Accordion — that
 * component is zinc/glass and lives in the out-of-scope admin tree).
 */
export function HistoryTable({ groups }: { groups: DayGroup<AlertItem>[] }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (groups.length === 0) {
    return <p className="text-sm text-ink-soft">Brak historii alertów.</p>;
  }

  return (
    <div>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <th className="px-2 py-2.5 font-semibold sm:px-3">Data</th>
            <th className="px-2 py-2.5 font-semibold sm:px-3">Opinie</th>
            <th className="px-2 py-2.5 font-semibold sm:px-3">PILNE</th>
            <th className="px-2 py-2.5 font-semibold sm:px-3">Śr. ★</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const open = openKeys.has(group.key);
            return (
              <HistoryRow
                key={group.key}
                group={group}
                open={open}
                onToggle={() => toggle(group.key)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HistoryRow({
  group,
  open,
  onToggle,
}: {
  group: DayGroup<AlertItem>;
  open: boolean;
  onToggle: () => void;
}) {
  const label = formatDatePl(`${group.key}T12:00:00Z`);

  return (
    <>
      <tr
        data-history-row={group.key}
        data-expanded={open ? "true" : "false"}
        className="cursor-pointer border-b border-line hover:bg-cream-2/70"
        onClick={onToggle}
      >
        <td className="px-2 py-3 sm:px-3">
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Zwiń" : "Rozwiń"} ${label}`}
            className="flex items-center gap-2 font-medium text-ink"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            <span
              aria-hidden="true"
              className={`inline-block text-[10px] text-gold-ink transition-transform ${open ? "rotate-90" : ""}`}
            >
              ▶
            </span>
            {label}
          </button>
        </td>
        <td className="px-2 py-3 text-ink-soft sm:px-3">{group.reviewCount}</td>
        <td className={`px-2 py-3 font-semibold sm:px-3 ${group.urgentCount > 0 ? "text-rose-ink" : "text-ink-soft"}`}>
          {group.urgentCount}
        </td>
        <td className="px-2 py-3 text-ink-soft sm:px-3">
          {group.averageRating == null ? "—" : group.averageRating.toFixed(1)}
        </td>
      </tr>
      {open && (
        <tr data-history-expanded={group.key}>
          <td colSpan={4} className="bg-cream-2/40 px-2 py-4 sm:px-3">
            <AlertsList alerts={group.alerts} loading={false} />
          </td>
        </tr>
      )}
    </>
  );
}
