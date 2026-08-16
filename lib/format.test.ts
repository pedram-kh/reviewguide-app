import assert from "node:assert/strict";
import { test } from "node:test";

import { formatDate, formatDateTime, formatDatePl, formatDateTimePl, warsawDayKey } from "./format.ts";

/**
 * Ticket 6.3 regression test, closed via ticket 6.9's `timeZone: "Europe/Warsaw"` pin.
 *
 * Set BEFORE importing anything that touches Intl/Date, and to a zone as far from Warsaw as
 * practical (Los Angeles, UTC-7 in August) — the point is that if someone ever drops the
 * `timeZone` option again, these assertions fail immediately rather than silently passing on a
 * machine/CI runner that happens to already run in Europe/Warsaw or UTC. This is exactly the
 * mismatch that produced ticket 6.3's live React #418: Next.js server-renders on one zone,
 * the browser reads another, and `formatDateTimePl`/`formatDatePl` disagreed with themselves
 * across the two without the pin.
 */
process.env.TZ = "America/Los_Angeles";

const INSTANT = "2026-08-16T02:30:00.000Z"; // 04:30 in Warsaw (UTC+2, CEST), 19:30 the *previous*
// day in Los Angeles (UTC-7, PDT) — deliberately crosses both the hour AND the calendar day, so
// a dropped `timeZone` option fails on either the string comparison or the day-key comparison.

test("formatDateTimePl renders Europe/Warsaw local time regardless of the host TZ", () => {
  assert.equal(process.env.TZ, "America/Los_Angeles", "test setup: TZ must be non-Warsaw");
  assert.equal(formatDateTimePl(INSTANT), "16 sie 2026, 04:30");
});

test("formatDatePl renders the Europe/Warsaw calendar date, not the host TZ's date", () => {
  // Same instant reads as 15 Aug in Los Angeles — this is the specific "off by one day" failure
  // mode ticket 6.9's Historia/Najnowsze day-bucketing depends on the pin to avoid.
  assert.equal(formatDatePl(INSTANT), "16 sie 2026");
});

test("warsawDayKey buckets by the Warsaw calendar day, not the host TZ's day", () => {
  assert.equal(warsawDayKey(INSTANT), "2026-08-16");
});

test("formatDateTimePl / formatDatePl return the placeholder for null/undefined, unaffected by TZ", () => {
  assert.equal(formatDateTimePl(null), "—");
  assert.equal(formatDateTimePl(undefined), "—");
  assert.equal(formatDatePl(null), "—");
});

// The en-GB /admin pair (ticket 6.3 scope item 2) had the identical defect and is called from
// "use client" components (`ReplyRow.tsx`, `LeadDetailClient.tsx`) — same hydration-mismatch risk,
// now pinned the same way.
test("formatDate renders the Europe/Warsaw calendar date in en-GB style, regardless of the host TZ", () => {
  assert.equal(formatDate(INSTANT), "16 Aug 2026");
});

test("formatDateTime renders Europe/Warsaw local time in en-GB style, regardless of the host TZ", () => {
  assert.equal(formatDateTime(INSTANT), "16 Aug 2026, 04:30");
});
