"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Ticket 6.9a bug 1: the drawer panel/backdrop are `position: fixed`, and the header
// (`lib/theme.ts`'s CUSTOMER_NAV) has `backdrop-blur-xl` — a `backdrop-filter` on an ancestor
// establishes a new containing block for fixed-position descendants (same rule as `filter`/
// `transform`), so `inset: 0` and `height: calc(100% - 74px)` were resolving against the 74px-tall
// header box instead of the viewport. Measured on a live mobile render: the backdrop painted as a
// 412×74 rectangle, the panel as a 320×38 sliver, both pinned to the header corner — which is
// exactly "transparent background, content bleeds through, doesn't work" from a phone. Portaling
// the drawer (not the desktop dropdown, which is deliberately anchored under the avatar button and
// stays in place) to `document.body` escapes that containing block entirely.
const DRAWER_TRANSITION_MS = 220;

function MenuContents({ email, onNavigate }: { email: string; onNavigate?: () => void }) {
  return (
    <>
      <p className="account-menu-email">{email}</p>
      <Link href="/app?tab=ustawienia" className="account-menu-item" onClick={onNavigate}>
        Ustawienia
      </Link>
      <form action="/api/billing/portal" method="post">
        <button type="submit" className="account-menu-item">
          Zarządzaj subskrypcją
        </button>
      </form>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="account-menu-item account-menu-item-danger">
          Wyloguj
        </button>
      </form>
    </>
  );
}

/**
 * Ticket 6.9 account menu. Two triggers, one panel: hamburger (≤768px) opens a slide-over
 * drawer; avatar circle (≥769px) opens a dropdown. Contents are identical. Focus is trapped
 * while open; Esc / backdrop / resize across the breakpoint all close it.
 */
export function AccountMenu({ email }: { email: string }) {
  // `open` is the logical/aria state; `rendered` keeps the panel mounted for the ~220ms exit
  // transition after `open` flips false, instead of yanking it out of the DOM mid-animation.
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [variant, setVariant] = useState<"drawer" | "dropdown">("dropdown");
  const panelRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  const initial = email.trim().charAt(0).toUpperCase() || "?";

  function openMenu(next: "drawer" | "dropdown") {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setVariant(next);
    setRendered(true);
    // Mount with the closed transform/opacity first, then flip to open on the next frame so the
    // browser actually animates the transition instead of painting the open state immediately.
    requestAnimationFrame(() => setOpen(true));
  }

  function closeMenu() {
    setOpen(false);
    closeTimerRef.current = setTimeout(() => {
      setRendered(false);
      closeTimerRef.current = null;
    }, DRAWER_TRANSITION_MS);
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute("disabled")) : [];

    const first = focusables()[0];
    first?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = focusables();
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    if (variant === "drawer") {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = previousOverflow;
        previouslyFocused?.focus();
      };
    }

    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [open, variant]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    function onChange() {
      closeMenu();
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open || variant !== "dropdown") return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (avatarRef.current?.contains(target)) return;
      closeMenu();
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, variant]);

  return (
    <div className="relative">
      <button
        ref={hamburgerRef}
        type="button"
        className="account-hamburger"
        aria-label={open && variant === "drawer" ? "Zamknij menu" : "Otwórz menu"}
        aria-expanded={open && variant === "drawer"}
        aria-controls={panelId}
        onClick={() => (open && variant === "drawer" ? closeMenu() : openMenu("drawer"))}
      >
        {open && variant === "drawer" ? (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <button
        ref={avatarRef}
        type="button"
        className="account-avatar"
        aria-label={`Konto ${email}`}
        aria-expanded={open && variant === "dropdown"}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => (open && variant === "dropdown" ? closeMenu() : openMenu("dropdown"))}
      >
        {initial}
      </button>

      {rendered && variant === "drawer" &&
        createPortal(
          <div
            className="account-menu-backdrop"
            data-open={open ? "true" : "false"}
            onClick={closeMenu}
            aria-hidden="true"
          />,
          document.body
        )}

      {rendered && variant === "drawer" &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal={true}
            aria-label="Menu konta"
            data-variant="drawer"
            data-open={open ? "true" : "false"}
            className="account-menu-panel"
          >
            <MenuContents email={email} onNavigate={closeMenu} />
          </div>,
          document.body
        )}

      {rendered && variant === "dropdown" && (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-label="Menu konta"
          data-variant="dropdown"
          data-open={open ? "true" : "false"}
          className="account-menu-panel"
        >
          <MenuContents email={email} onNavigate={closeMenu} />
        </div>
      )}
    </div>
  );
}
