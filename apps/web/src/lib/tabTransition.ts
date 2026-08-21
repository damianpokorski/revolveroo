export const TAB_TRANSITIONS = ["none", "crossfade", "slide"] as const;
export type TabTransition = (typeof TAB_TRANSITIONS)[number];

export const DEFAULT_TAB_TRANSITION: TabTransition = "crossfade";

export const TAB_TRANSITION_LABELS: Record<TabTransition, string> = {
	none: "None",
	crossfade: "Crossfade",
	slide: "Slide",
};
