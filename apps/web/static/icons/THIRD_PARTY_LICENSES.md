# Third-party icon data attribution

This directory (and `apps/web/static/fonts/SymbolsNerdFontMono-Regular.woff2`, fetched separately via `bun run fonts:setup`) bundles data derived from third-party projects.

## Nerd Fonts

- `nerd-font-glyphnames.json` is generated from [`ryanoasis/nerd-fonts`](https://github.com/ryanoasis/nerd-fonts)'s `glyphnames.json`.
- The Symbols Nerd Font itself is licensed under the [SIL Open Font License 1.1](https://github.com/ryanoasis/nerd-fonts/blob/master/LICENSE); Nerd Fonts' own source/tooling is MIT-licensed. See the upstream [LICENSE](https://github.com/ryanoasis/nerd-fonts/blob/master/LICENSE) for the full breakdown across the aggregated icon sets (Font Awesome, Material Design Icons, Octicons, Devicons, Weather Icons, Codicons, Powerline, Pomicons, and others).

## Emoji data

- `emoji-data.json` is generated from [`emojibase-data`](https://github.com/milesj/emojibase) (MIT License), itself derived from Unicode CLDR annotation data (Unicode Data Files License).

Regenerate both JSON files with `bun run generate:icons` (`apps/web/scripts/generate-icon-data.ts`) — an opt-in maintenance script, not run automatically.
