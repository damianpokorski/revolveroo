// Inline stroke-SVG glyph set (spec 4.5: never emoji, never an icon font, for UI
// chrome). Path data at 24x24, stroke rendered by Icon.svelte. Replaces the
// Font Awesome CDN icon font previously used in Settings.
export const ICON_PATHS = {
  "grip-vertical": [
    "M9 5a1 1 0 1 1 0 .01M9 12a1 1 0 1 1 0 .01M9 19a1 1 0 1 1 0 .01M15 5a1 1 0 1 1 0 .01M15 12a1 1 0 1 1 0 .01M15 19a1 1 0 1 1 0 .01",
  ],
  trash: [
    "M4 7h16",
    "M10 11v6",
    "M14 11v6",
    "M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12",
    "M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3",
  ],
  pencil: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"],
  plus: ["M12 5v14", "M5 12h14"],
  "chevron-down": ["M6 9l6 6 6-6"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  check: ["M20 6 9 17l-5-5"],
  copy: [
    "M9 9h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V11a2 2 0 0 1 1-1.73",
    "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  ],
  "qr-code": [
    "M3 3h6v6H3z",
    "M15 3h6v6h-6z",
    "M3 15h6v6H3z",
    "M15 15h2v2h-2z",
    "M19 15h2v2h-2z",
    "M15 19h2v2h-2z",
    "M19 19h2v2h-2z",
  ],
  "external-link": [
    "M15 3h6v6",
    "M10 14 21 3",
    "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  ],
  "alert-triangle": [
    "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z",
    "M12 9v4",
    "M12 17h.01",
  ],
  "more-horizontal": ["M5 12a1 1 0 1 1 0 .01M12 12a1 1 0 1 1 0 .01M19 12a1 1 0 1 1 0 .01"],
  play: ["M6 3l14 9-14 9V3z"],
  pause: ["M7 4h3v16H7z", "M14 4h3v16h-3z"],
  "skip-forward": ["M4 4l10 8-10 8V4z", "M18 4h2v16h-2z"],
  music: [
    "M9 18V5l12-2v13",
    "M9 18A3 3 0 1 1 3 18A3 3 0 1 1 9 18",
    "M21 16A3 3 0 1 1 15 16A3 3 0 1 1 21 16",
  ],
  eye: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M15 12A3 3 0 1 1 9 12A3 3 0 1 1 15 12"],
  "eye-off": [
    "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z",
    "M15 12A3 3 0 1 1 9 12A3 3 0 1 1 15 12",
    "M3 3l18 18",
  ],
} as const;

export type IconName = keyof typeof ICON_PATHS;
