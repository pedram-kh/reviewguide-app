"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Icon } from "./icons";

/**
 * Collapsible group wrapper (ticket 6.4 amendment, Stakeholder UI request, 2026-08-14). Used by
 * both the customer-detail alert history (grouped by run/date) and the run-detail per-customer
 * breakdown — same interaction, different data.
 *
 * Animates a measured `max-height` in px rather than the more commonly suggested
 * `grid-template-rows: 0fr`/`1fr` trick: in a container whose own height is otherwise intrinsic
 * (no explicit height set, which is the case here), a lone flexible row track is sized to its
 * content's max-content height for the purpose of the *container's own* auto-height computation —
 * i.e. `0fr` does not actually collapse it to zero, only a definite pixel value does. `max-height:
 * none` (the initial, pre-hydration state for whichever group starts open) can't itself be
 * transitioned, so the effect below swaps it for a measured pixel value right after mount, and
 * every toggle after that animates between two real numbers.
 *
 * The toggle target is the small chevron button, not the whole header row wrapped in a
 * `<button>`: every caller needs a real, keyboard-operable `<Link>` inside `label` (to the run
 * or the customer), and `<a>` inside `<button>` is invalid HTML. The header `<div>` also carries
 * an `onClick` for mouse users so clicking anywhere in the row (not just the chevron) toggles —
 * a click landing on the nested `<Link>` still navigates and also bubbles into that handler, which
 * is harmless because the page is about to unload anyway.
 */
export function Accordion({
  label,
  meta,
  defaultOpen,
  children,
}: {
  label: ReactNode;
  meta: ReactNode;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [maxHeight, setMaxHeight] = useState<string>(defaultOpen ? "none" : "0px");
  const bodyRef = useRef<HTMLDivElement>(null);
  const toggle = () => setOpen((value) => !value);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // scrollHeight reflects the content's real height regardless of the clipping max-height
    // applies visually, so this is accurate whether the group starts open or collapsed.
    setMaxHeight(open ? `${el.scrollHeight}px` : "0px");
  }, [open]);

  return (
    // data-state is a test hook, not a styling hook: Playwright's visibility checks look at an
    // element's own box and computed visibility/display, not whether an ancestor clips it via
    // `overflow: hidden` + zero height — so a collapsed group's text still reads as "visible" to
    // `toBeVisible()` even though no human sees it. Asserting on this attribute instead is exact.
    <div data-accordion-state={open ? "open" : "closed"}>
      <div
        onClick={toggle}
        className="flex cursor-pointer flex-wrap items-baseline gap-2 border-b border-white/60 pb-1"
      >
        <button
          type="button"
          onClick={(event) => {
            // Without this, the click would bubble to the div above and toggle a second time,
            // cancelling itself out — the chevron would look and feel like it does nothing.
            event.stopPropagation();
            toggle();
          }}
          aria-expanded={open}
          aria-label={open ? "Collapse group" : "Expand group"}
          className="shrink-0 rounded text-zinc-400 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          <Icon
            name="chevron-down"
            className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          />
        </button>
        {label}
        {meta}
      </div>
      <div
        ref={bodyRef}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight }}
      >
        <div className="mt-3 flex flex-col gap-3 sm:gap-4">{children}</div>
      </div>
    </div>
  );
}
