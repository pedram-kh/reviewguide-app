"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

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
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<"drawer" | "dropdown">("dropdown");
  const panelRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const initial = email.trim().charAt(0).toUpperCase() || "?";

  function openMenu(next: "drawer" | "dropdown") {
    setVariant(next);
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
  }

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

      {open && variant === "drawer" && (
        <div className="account-menu-backdrop" onClick={closeMenu} aria-hidden="true" />
      )}

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role={variant === "drawer" ? "dialog" : "menu"}
          aria-modal={variant === "drawer" ? true : undefined}
          aria-label="Menu konta"
          data-variant={variant}
          className="account-menu-panel"
        >
          <MenuContents email={email} onNavigate={closeMenu} />
        </div>
      )}
    </div>
  );
}
