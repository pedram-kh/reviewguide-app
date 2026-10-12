import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultLeadSort, resolveLeadSort } from "./leadSort.ts";

test("queued leads default to expiring soonest (oldest review first)", () => {
  assert.equal(defaultLeadSort("queued"), "review_date_asc");
  assert.equal(resolveLeadSort(undefined, "queued"), "review_date_asc");
});

test("every other view keeps newest review first", () => {
  for (const status of [undefined, "", "new", "enriched", "sent", "replied", "dead"]) {
    assert.equal(defaultLeadSort(status), "review_date_desc", `status=${String(status)}`);
    assert.equal(resolveLeadSort(undefined, status), "review_date_desc");
  }
});

test("an explicit sort always wins, including on the queued view", () => {
  assert.equal(resolveLeadSort("review_date_desc", "queued"), "review_date_desc");
  assert.equal(resolveLeadSort("created_at", "queued"), "created_at");
  assert.equal(resolveLeadSort("review_date_asc", undefined), "review_date_asc");
});

test("an empty sort param falls back to the status default", () => {
  assert.equal(resolveLeadSort("", "queued"), "review_date_asc");
});
