import assert from "node:assert/strict";
import { test } from "node:test";

import {
  groupAlertsByWarsawDay,
  latestDayAlerts,
  sortNajnowsze,
  type GroupableAlert,
} from "./alertGroups.ts";

/**
 * Ticket 6.16 regression test — fixes Q2 of the 6.15 investigation (a review with review_date
 * ~a month in the past, bundled into a day-one digest, displayed under "today" in Historia and
 * fed to Najnowsze as if it were the newest day's content).
 *
 * process.env.TZ is pinned non-Warsaw (same discipline as format.test.ts's 6.3/6.9 regression
 * test) so a dropped `timeZone` option inside warsawDayKey would fail here too, not just there.
 */
process.env.TZ = "America/Los_Angeles";

function alert(overrides: Partial<GroupableAlert>): GroupableAlert {
  return {
    created_at: "2026-08-17T21:13:36.000Z",
    review_date: null,
    review_rating: null,
    is_urgent: false,
    ...overrides,
  };
}

test("groupAlertsByWarsawDay buckets a day-one digest's old review under ITS OWN date, not the connect date", () => {
  // The exact 6.15 Q2 shape: day-one digest created 2026-08-17, review actually dated 2026-07-17.
  const oldReview = alert({
    created_at: "2026-08-17T21:13:36.000Z",
    review_date: "2026-07-17T10:00:00.000Z",
  });
  const groups = groupAlertsByWarsawDay([oldReview]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "2026-07-17", "must group by review_date, not created_at (2026-08-17)");
});

test("groupAlertsByWarsawDay falls back to created_at when review_date is null (legacy rows)", () => {
  const legacyRow = alert({ created_at: "2026-08-17T21:13:36.000Z", review_date: null });
  const groups = groupAlertsByWarsawDay([legacyRow]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "2026-08-17");
});

test("groupAlertsByWarsawDay: mixed batch splits into separate day groups by review_date", () => {
  const today = alert({ created_at: "2026-08-17T21:13:36.000Z", review_date: "2026-08-17T20:00:00.000Z" });
  const monthOld = alert({ created_at: "2026-08-17T21:13:36.000Z", review_date: "2026-07-17T10:00:00.000Z" });
  const groups = groupAlertsByWarsawDay([today, monthOld]);
  const keys = groups.map((g) => g.key).sort();
  assert.deepEqual(keys, ["2026-07-17", "2026-08-17"]);
});

test("latestDayAlerts (Najnowsze) picks the newest REVIEW day, not the newest created_at day", () => {
  // Two alerts, same digest batch (created_at identical), different review_date — Najnowsze must
  // surface the one whose review is actually newest, matching sortNajnowsze's own review_date-first
  // ordering (lib/alertGroups.ts's existing sortNajnowsze), not an artifact of when they were fetched.
  const newer = alert({
    created_at: "2026-08-17T21:13:36.000Z",
    review_date: "2026-08-16T09:00:00.000Z",
  });
  const older = alert({
    created_at: "2026-08-17T21:13:36.000Z",
    review_date: "2026-07-17T10:00:00.000Z",
  });
  const latest = latestDayAlerts([older, newer]);
  assert.equal(latest.length, 1, "only the newest Warsaw day's alerts, not both");
  assert.equal(latest[0].review_date, "2026-08-16T09:00:00.000Z");
});

test("Historia ordering stays sane: day groups sort newest-first by their (review_date-derived) key", () => {
  const dayA = alert({ created_at: "2026-08-01T08:00:00.000Z", review_date: "2026-08-01T08:00:00.000Z" });
  const dayB = alert({ created_at: "2026-08-10T08:00:00.000Z", review_date: "2026-08-10T08:00:00.000Z" });
  const dayC = alert({ created_at: "2026-07-01T08:00:00.000Z", review_date: "2026-07-01T08:00:00.000Z" });
  const groups = groupAlertsByWarsawDay([dayA, dayB, dayC]);
  assert.deepEqual(groups.map((g) => g.key), ["2026-08-10", "2026-08-01", "2026-07-01"]);
});

test("sortNajnowsze (unchanged, already correct) still prefers review_date over created_at within a day", () => {
  const a = alert({ review_date: "2026-08-16T09:00:00.000Z", is_urgent: false });
  const b = alert({ review_date: "2026-08-16T18:00:00.000Z", is_urgent: false });
  const sorted = sortNajnowsze([a, b]);
  assert.equal(sorted[0].review_date, "2026-08-16T18:00:00.000Z");
});
