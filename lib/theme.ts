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
