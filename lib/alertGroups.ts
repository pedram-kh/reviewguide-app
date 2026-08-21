// Relative import (not the "@/lib/format" alias used elsewhere) so this module resolves under
// plain `node --test` too, matching format.test.ts's own node:test setup — the alias only
// resolves via Next.js's own bundler/tsconfig paths, which the test runner doesn't use.
import { warsawDayKey } from "./format.ts";

/** Structural slice of a customer alert — kept local so this module can be imported from
 *  client components without pulling in lib/customerApi.ts (`import "server-only"`). */
export interface GroupableAlert {
  created_at: string;
  review_date: string | null;
  review_rating: number | null;
  is_urgent: boolean;
}

export interface DayGroup<T extends GroupableAlert = GroupableAlert> {
  key: string;
  alerts: T[];
  reviewCount: number;
  urgentCount: number;
  averageRating: number | null;
}

export function sortNajnowsze<T extends GroupableAlert>(alerts: T[]): T[] {
  return [...alerts].sort((a, b) => {
    if (a.is_urgent !== b.is_urgent) return a.is_urgent ? -1 : 1;
    const ta = Date.parse(a.review_date ?? a.created_at);
    const tb = Date.parse(b.review_date ?? b.created_at);
    return tb - ta;
  });
}

export function groupAlertsByWarsawDay<T extends GroupableAlert>(alerts: T[]): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const alert of alerts) {
    // Ticket 6.16 (fixes Q2 of the 6.15 investigation): a day-one digest can bundle reviews far
    // older than the connect date, and this key drives BOTH the Historia day header the customer
    // reads and Najnowsze's "which day is newest" selection — created_at alone made a month-old
    // review surface as "today". `review_date` is the actual review date and is preferred; the
    // fallback covers any legacy/malformed row where it's ever null.
    const key = warsawDayKey(alert.review_date ?? alert.created_at);
    const list = map.get(key);
    if (list) list.push(alert);
    else map.set(key, [alert]);
  }

  const groups: DayGroup<T>[] = [];
  for (const [key, dayAlerts] of map) {
    const ratings = dayAlerts
      .map((item) => item.review_rating)
      .filter((rating): rating is number => rating != null);
    groups.push({
      key,
      alerts: sortNajnowsze(dayAlerts),
      reviewCount: dayAlerts.length,
      urgentCount: dayAlerts.filter((item) => item.is_urgent).length,
      averageRating:
        ratings.length === 0 ? null : ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
    });
  }

  groups.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  return groups;
}

/** Alerts from the most recent Warsaw day that produced any — empty checks never appear. */
export function latestDayAlerts<T extends GroupableAlert>(alerts: T[]): T[] {
  return groupAlertsByWarsawDay(alerts)[0]?.alerts ?? [];
}

export function urgentCountLast7Days(alerts: GroupableAlert[], now: Date = new Date()): number {
  const todayMs = Date.parse(`${warsawDayKey(now.toISOString())}T00:00:00Z`);
  return alerts.filter((alert) => {
    if (!alert.is_urgent) return false;
    const dayMs = Date.parse(`${warsawDayKey(alert.created_at)}T00:00:00Z`);
    const diffDays = (todayMs - dayMs) / 86_400_000;
    return diffDays >= 0 && diffDays < 7;
  }).length;
}
