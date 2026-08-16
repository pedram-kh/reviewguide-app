export const PANEL_TABS = ["najnowsze", "historia", "ustawienia"] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

export function parsePanelTab(value: string | null | undefined): PanelTab {
  if (value === "historia" || value === "ustawienia") return value;
  return "najnowsze";
}
