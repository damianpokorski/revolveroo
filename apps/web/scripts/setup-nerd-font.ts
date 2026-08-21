// Fetches and builds the self-hosted Nerd Font asset used by the tab icon picker
// (@font-face in app.css). Not committed to git (binary, large) — run this instead:
//   - once after cloning, as part of dev setup (bun run fonts:setup)
//   - in the Dockerfile's builder stage, before `bun run build`
// Idempotent: skips the download/convert if the output file already exists.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync } from "fflate";

const NERD_FONTS_VERSION = "v3.5.0";
const RELEASE_ZIP_URL = `https://github.com/ryanoasis/nerd-fonts/releases/download/${NERD_FONTS_VERSION}/NerdFontsSymbolsOnly.zip`;
const TTF_ENTRY_NAME = "SymbolsNerdFontMono-Regular.ttf";
const OUT_PATH = join(
	import.meta.dir,
	"../static/fonts/SymbolsNerdFontMono-Regular.woff2",
);

async function main() {
	if (existsSync(OUT_PATH)) {
		console.log(`${OUT_PATH} already exists, skipping fetch.`);
		return;
	}

	console.log(`Downloading ${RELEASE_ZIP_URL}...`);
	const res = await fetch(RELEASE_ZIP_URL);
	if (!res.ok) {
		throw new Error(`Failed to download Nerd Fonts release: ${res.status}`);
	}
	const zipBuffer = new Uint8Array(await res.arrayBuffer());

	const entries = unzipSync(zipBuffer, {
		filter: (file) => file.name === TTF_ENTRY_NAME,
	});
	const ttfBuffer = entries[TTF_ENTRY_NAME];
	if (!ttfBuffer) {
		throw new Error(`${TTF_ENTRY_NAME} not found in release archive`);
	}

	console.log("Converting TTF to WOFF2...");
	const { compress } = await import("wawoff2");
	const woff2Buffer = (await compress(ttfBuffer)) as Uint8Array;

	await mkdir(join(import.meta.dir, "../static/fonts"), { recursive: true });
	await writeFile(OUT_PATH, woff2Buffer);
	console.log(`Wrote ${OUT_PATH}`);
}

await main();
