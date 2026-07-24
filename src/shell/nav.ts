export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/backtesting", label: "Backtesting" },
  { to: "/angebote", label: "Angebote" },
  { to: "/backtest-anfragen", label: "Backtest anfragen" },
];
