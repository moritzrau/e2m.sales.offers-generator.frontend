export type NavKey = "dashboard" | "offers" | "backtesting" | "pricing";

export const NAV_ITEMS: { key: NavKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "offers", label: "Angebote" },
  { key: "backtesting", label: "Backtesting" },
  { key: "pricing", label: "Pricing" },
];
