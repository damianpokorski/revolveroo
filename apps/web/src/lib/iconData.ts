import { base } from "$app/paths";

export interface NerdFontIcon {
	name: string;
	char: string;
	set: string;
}

export interface EmojiIcon {
	char: string;
	label: string;
	keywords: string[];
}

let nerdFontIcons: Promise<NerdFontIcon[]> | undefined;
let emojiIcons: Promise<EmojiIcon[]> | undefined;

export function loadNerdFontIcons(): Promise<NerdFontIcon[]> {
	nerdFontIcons ??= fetch(`${base}/icons/nerd-font-glyphnames.json`).then(
		(res) => res.json(),
	);
	return nerdFontIcons;
}

export function loadEmojiIcons(): Promise<EmojiIcon[]> {
	emojiIcons ??= fetch(`${base}/icons/emoji-data.json`).then((res) =>
		res.json(),
	);
	return emojiIcons;
}
