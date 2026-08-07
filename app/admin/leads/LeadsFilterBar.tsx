"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import type { LeadSort, LeadStatus } from "@/lib/api";
import { GLASS_CARD } from "@/lib/theme";

const STATUS_OPTIONS: LeadStatus[] = [
  "new",
  "response_generated",
  "enriched",
  "queued",
  "sent",
  "replied",
  "converted",
  "dead",
];

const CHANNEL_OPTIONS = ["facebook", "email", "contact_form"];

const SORT_OPTIONS: { value: LeadSort; label: string }[] = [
  { value: "review_date_desc", label: "Newest review first" },
  { value: "review_date_asc", label: "Oldest review first" },
  { value: "created_at", label: "Created at" },
];

export function LeadsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("toast"); // filters change -> any prior toast is stale
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    updateParam("search", search);
  }

  const hasFilters = ["status", "channel", "health_flag", "search"].some((key) =>
    searchParams.get(key)
  );

  return (
    <div className={`flex flex-wrap items-end gap-3 ${GLASS_CARD} p-4`}>
      <Field label="Status">
        <select
          value={searchParams.get("status") ?? ""}
          onChange={(e) => updateParam("status", e.target.value)}
          className="rounded-lg border border-zinc-300/80 bg-white/80 px-2 py-1.5 text-sm"
        >
          <option value="">Any</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Channel">
        <select
          value={searchParams.get("channel") ?? ""}
          onChange={(e) => updateParam("channel", e.target.value)}
          className="rounded-lg border border-zinc-300/80 bg-white/80 px-2 py-1.5 text-sm"
        >
          <option value="">Any</option>
          {CHANNEL_OPTIONS.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Health flag">
        <select
          value={searchParams.get("health_flag") ?? ""}
          onChange={(e) => updateParam("health_flag", e.target.value)}
          className="rounded-lg border border-zinc-300/80 bg-white/80 px-2 py-1.5 text-sm"
        >
          <option value="">Any</option>
          <option value="true">⚠ Flagged</option>
          <option value="false">Not flagged</option>
        </select>
      </Field>

      <Field label="Sort">
        <select
          value={searchParams.get("sort") ?? "review_date_desc"}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="rounded-lg border border-zinc-300/80 bg-white/80 px-2 py-1.5 text-sm"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      <form onSubmit={submitSearch} className="flex items-end gap-2">
        <Field label="Search restaurant name">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Bar Prasowy"
            className="rounded-lg border border-zinc-300/80 bg-white/80 px-2 py-1.5 text-sm"
          />
        </Field>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300/80 bg-white/80 px-3 py-1.5 text-sm hover:bg-white"
        >
          Search
        </button>
      </form>

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            router.push(pathname);
          }}
          className="text-sm text-zinc-500 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
      {label}
      {children}
    </label>
  );
}
