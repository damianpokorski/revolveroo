// Matches combining diacritical marks (U+0300–U+036F) left behind after NFKD
// normalization splits an accented character into base + mark.
const DIACRITICS_PATTERN = /[̀-ͯ]/g;

export function slugify(input: string): string {
	const base = input
		.normalize("NFKD")
		.replace(DIACRITICS_PATTERN, "")
		.toLowerCase()
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return base || "item";
}

export function uniqueSlug(
	base: string,
	existingKeys: Iterable<string>,
): string {
	const existing = new Set(existingKeys);
	if (!existing.has(base)) return base;
	let suffix = 2;
	while (existing.has(`${base}-${suffix}`)) suffix++;
	return `${base}-${suffix}`;
}
