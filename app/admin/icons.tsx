/**
 * Minimal hand-rolled icon set for the /admin glassmorphism pass (UAT-4, ticket 3.4-UAT).
 * No icon library is installed — these are small stroke-based outlines (Heroicons-style,
 * 20x20 viewBox) covering just the shapes the dashboard's stat cards need.
 */
export type IconName =
  | "circle"
  | "sparkle"
  | "map-pin"
  | "clock"
  | "paper-plane"
  | "chat"
  | "check"
  | "x"
  | "chart-bar"
  | "envelope"
  | "chevron-down";

function IconPath({ name }: { name: IconName }) {
  switch (name) {
    case "circle":
      return <circle cx="10" cy="10" r="6" />;
    case "sparkle":
      return (
        <path d="M10 2.5l1.8 4.3 4.3 1.8-4.3 1.8L10 14.7l-1.8-4.3-4.3-1.8 4.3-1.8L10 2.5Z" strokeLinejoin="round" />
      );
    case "map-pin":
      return (
        <>
          <path d="M10 17.5s5.5-5.05 5.5-9A5.5 5.5 0 0 0 4.5 8.5c0 3.95 5.5 9 5.5 9Z" strokeLinejoin="round" />
          <circle cx="10" cy="8.5" r="2" />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="10" cy="10" r="7" />
          <path d="M10 6.5V10l2.5 1.5" strokeLinecap="round" />
        </>
      );
    case "paper-plane":
      return <path d="M3 10l14-6.5-5 13.5-2-5.5-7-1.5Z" strokeLinejoin="round" />;
    case "chat":
      return (
        <path
          d="M4 5h12a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 2.5v-2.5H4A1.5 1.5 0 0 1 2.5 12.5v-6A1.5 1.5 0 0 1 4 5Z"
          strokeLinejoin="round"
        />
      );
    case "check":
      return <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />;
    case "x":
      return <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />;
    case "chart-bar":
      return (
        <>
          <path d="M4.5 16v-5" strokeLinecap="round" />
          <path d="M10 16V6" strokeLinecap="round" />
          <path d="M15.5 16V9" strokeLinecap="round" />
        </>
      );
    case "envelope":
      return <path d="M3 5.5h14v9H3v-9Zm0 0 7 6 7-6" strokeLinejoin="round" />;
    case "chevron-down":
      return <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />;
  }
}

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <IconPath name={name} />
    </svg>
  );
}
