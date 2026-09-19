// UI-only tri-state, deliberately not the wire shape: the wire model only has
// `displays: string[] | null` ("null/empty = every display"), but the *form*
// needs to distinguish "Every display" (toggle on, saves null) from "Specific
// displays, currently zero picked" (toggle off, blocks Save) even though both
// would otherwise collapse to the same wire value.
export type ShowsOnMode = "every" | "specific";

export interface EditTabWindow {
	windowId: string;
	days: number[];
}
