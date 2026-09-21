export const THEMES = [
  "mocha",
  "macchiato",
  "frappe",
  "latte",
  "rose-pine",
  "rose-pine-dawn",
  "tokyo-night",
  "tokyo-night-day",
  "kanagawa",
  "kanagawa-lotus",
  "nord",
  "dracula",
] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "mocha";

export const THEME_LABELS: Record<Theme, string> = {
  mocha: "Mocha (Dark)",
  macchiato: "Macchiato (Dark)",
  frappe: "Frappé (Dark)",
  latte: "Latte (Light)",
  "rose-pine": "Rosé Pine (Dark)",
  "rose-pine-dawn": "Rosé Pine Dawn (Light)",
  "tokyo-night": "Tokyo Night (Dark)",
  "tokyo-night-day": "Tokyo Night Day (Light)",
  kanagawa: "Kanagawa (Dark)",
  "kanagawa-lotus": "Kanagawa Lotus (Light)",
  nord: "Nord (Dark)",
  dracula: "Dracula (Dark)",
};

// Keep in sync with the inline FOUC-prevention script in apps/web/src/app.html.
const STORAGE_KEY = "revolver-theme";

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable (e.g. private browsing) — non-fatal, just skip caching.
  }
}
