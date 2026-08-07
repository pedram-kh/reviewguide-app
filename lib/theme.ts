/**
 * Shared glassmorphism tokens for /admin (Stakeholder UAT ticket 3.4-UAT / UAT-4).
 *
 * Styling only — these classnames carry no information themselves, they just keep the
 * frosted-glass look (backdrop-blur, translucent white, soft border/shadow, rounded-2xl)
 * consistent across every admin page instead of each page re-inventing it slightly differently.
 * Kept as plain strings (not computed) so Tailwind's static scanner can see every class.
 */
export const GLASS_CARD =
  "rounded-2xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-sm shadow-indigo-100/60";

export const GLASS_NAV = "border-b border-white/50 bg-white/60 backdrop-blur-xl";

export const PAGE_BACKGROUND = "min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50";
