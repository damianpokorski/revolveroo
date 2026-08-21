// Opt-in maintenance script, not run as part of dev/build/check/CI.
// Re-run manually to refresh the icon picker's data (bun run generate:icons):
//   - Nerd Font glyphs come from the official nerd-fonts glyphnames.json (fetched live).
//   - Emoji come from the emojibase-data devDependency (never imported by app code).
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const NERD_FONT_GLYPHNAMES_URL =
	"https://raw.githubusercontent.com/ryanoasis/nerd-fonts/master/glyphnames.json";

interface NerdFontIcon {
	name: string;
	char: string;
	set: string;
}

interface EmojiIcon {
	char: string;
	label: string;
	keywords: string[];
}

async function generateNerdFontData() {
	const res = await fetch(NERD_FONT_GLYPHNAMES_URL);
	if (!res.ok) {
		throw new Error(`Failed to fetch glyphnames.json: ${res.status}`);
	}
	const raw = (await res.json()) as Record<
		string,
		{ char: string; code: string }
	>;

	const icons: NerdFontIcon[] = Object.entries(raw)
		.filter(([name]) => name !== "METADATA")
		.map(([name, entry]) => ({
			name,
			char: entry.char,
			set: name.split("-")[0],
		}));

	const outPath = join(
		import.meta.dir,
		"../static/icons/nerd-font-glyphnames.json",
	);
	await writeFile(outPath, JSON.stringify(icons));
	console.log(`Wrote ${icons.length} nerd font icons to ${outPath}`);
}

async function generateEmojiData() {
	const module = await import("emojibase-data/en/data.json");
	const data = module.default as Array<{
		emoji: string;
		label: string;
		tags?: string[];
		group?: number;
	}>;

	const icons: EmojiIcon[] = data
		.filter((entry) => entry.group !== undefined)
		.map((entry) => ({
			char: entry.emoji,
			label: entry.label,
			keywords: entry.tags ?? [],
		}));

	const outPath = join(import.meta.dir, "../static/icons/emoji-data.json");
	await writeFile(outPath, JSON.stringify(icons));
	console.log(`Wrote ${icons.length} emoji icons to ${outPath}`);
}

await generateNerdFontData();
await generateEmojiData();
