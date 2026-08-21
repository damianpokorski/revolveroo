export const THEMES = ["mocha", "macchiato", "frappe", "latte"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "mocha";

export const THEME_LABELS: Record<Theme, string> = {
	mocha: "Mocha (Dark)",
	macchiato: "Macchiato (Dark)",
	frappe: "Frappé (Dark)",
	latte: "Latte (Light)",
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
