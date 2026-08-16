/**
 * Shared glassmorphism tokens for /admin (Stakeholder UAT ticket 3.4-UAT / UAT-4).
 *
 * Styling only — these classnames carry no information themselves, they just keep the
 * frosted-glass look (backdrop-blur, translucent white, soft border/shadow, rounded-2xl)
 * consistent across every admin page instead of each page re-inventing it slightly differently.
 * Kept as plain strings (not computed) so Tailwind's static scanner can see every class.
 */
// Stakeholder UI polish round 2: the border alone read as too faint to separate cards from the
// gradient background, so the shadow carries more of that definition instead of darkening the
// border itself (which would fight the frosted-glass look). A plain box-shadow only renders
// below/around the box (it simulates a light source from above), so it left the *top* edge of
// every card just as faint as before — the `ring` is a uniform outline that isn't
// direction-dependent, so it defines the top edge the shadow alone couldn't.
export const GLASS_CARD =
  "rounded-2xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-lg shadow-indigo-200/50 ring-1 ring-black/5";

export const GLASS_NAV = "border-b border-white/50 bg-white/60 backdrop-blur-xl";

export const PAGE_BACKGROUND = "min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50";

/**
 * Cream/gold tokens for the customer-facing pages (/signup, /login, /auth/verify, /app).
 * SPRINT_04.md ticket 4.2 originally put these on a dark frosted-glass theme to match the
 * THEN-dark landing (zero visible seam landing -> signup -> app). Ticket 6.8 (2026-08-15)
 * re-themes them to cream/gold instead, because the landing itself went cream/gold in ticket
 * 6.5 — the invariant the 4.2 decision protects is the *seam*, not any particular palette (see
 * ROADMAP.md's "Brand theme split" row). /admin (internal, different audience) is intentionally
 * untouched and stays on the light-glass GLASS_CARD/PAGE_BACKGROUND above.
 *
 * Values reference the CSS custom properties copied into app/globals.css from
 * reviewguide-marketing/app/globals.css (ticket 6.5's :root block) via Tailwind's utility
 * classes (bg-cream, border-line, ...) rather than duplicating the hex values here.
 */
export const CUSTOMER_PAGE_BACKGROUND = "customer-shell min-h-screen bg-cream text-ink";

export const CUSTOMER_NAV = "sticky top-0 z-[70] border-b border-line bg-cream/90 backdrop-blur-xl";

export const CUSTOMER_CARD = "rg-card";
