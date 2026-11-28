export const POPUP_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type PopupCorner = (typeof POPUP_CORNERS)[number];

export const DEFAULT_POPUP_CORNER: PopupCorner = "top-left";

export const POPUP_CORNER_LABELS: Record<PopupCorner, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
};
