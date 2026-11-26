# Docs source

The markdown in this folder is the source of the [Revolveroo docs site](https://damianpokorski.github.io/revolveroo/), built with Astro and Starlight from `apps/docs`. It stays plain markdown so it reads fine on GitHub and isn't tied to Astro. `apps/docs/src/content/docs` is a symlink to this folder, because Starlight hardcodes that path.

This file is not published. Only `index.md` and files inside the numbered folders are.

## Layout

| Folder               | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `01-getting-started` | Install and first-run walkthroughs.                       |
| `02-guides`          | One page per feature, task-oriented.                      |
| `03-concepts`        | How things work and why.                                  |
| `04-reference`       | Lookup tables: env vars, data file schema, API, security. |

Numeric prefixes only sort things on disk. They are stripped from URLs, so `02-guides/03-foo.md` is served at `/guides/foo/`. Order within a section comes from `sidebar.order` in each file's frontmatter.

## Writing a page

Every page needs frontmatter:

```yaml
---
title: Short page title
description: One sentence, shown in search results.
sidebar:
  order: 3
---
```

- Use plain `.md`, not MDX. The content loader only reads `.md` files.
- Use `:::note`, `:::caution` and similar for callouts.
- No emoji.

## Links

The site is served under a base path (`/revolveroo`), and Markdown links are not prefixed automatically. Write internal links with the base included:

```md
[Displays](/revolveroo/guides/displays/)
```

If the base changes (custom domain, repo rename), update `base` in `apps/docs/astro.config.mjs` and find-and-replace `/revolveroo/` here.

## Screenshots

Screenshots live in `apps/docs/src/assets/screenshots/` and are generated, not hand-taken:

```bash
bun run docs:screenshots
```

That runs `apps/web/e2e/showcase/screenshots.spec.ts` against a disposable data file. Review the changed PNGs by hand before committing.

Embed them with a path relative to the symlinked location, and always write alt text:

```md
![The kiosk showing a dashboard.](../../../assets/screenshots/kiosk.png)
```

Editor previews of this folder will not show images, since that path only resolves through the symlink.

### Light/dark pairs

Most screenshots use the app's dark `mocha` theme and have a `-day` counterpart generated with `tokyo-night-day`, shown instead when a reader has the docs site itself in light mode. Since the content loader only reads `.md`, there is no MDX/component import for this — use raw HTML with Starlight's built-in `dark:sl-hidden` / `light:sl-hidden` utility classes instead of a plain `![]()`:

```html
<img
  src="/revolveroo/screenshots/kiosk.png"
  alt="The kiosk showing a dashboard."
  class="light:sl-hidden"
/>
<img
  src="/revolveroo/screenshots/kiosk-day.png"
  alt="The kiosk showing a dashboard."
  class="dark:sl-hidden"
/>
```

A raw `<img>` bypasses Astro's asset-optimization pipeline entirely, so unlike every other screenshot these pairs are **not** in `src/assets/screenshots/` — they're written straight to `apps/docs/public/screenshots/` (served verbatim, path prefixed with the site's base) by `screenshots.spec.ts`. `kiosk.png` is the one exception, written to both places — not for the hero (see below, it's a video now) but because the root `README.md` links `apps/docs/src/assets/screenshots/kiosk.png` directly as a raw GitHub image, outside Astro entirely.

Starlight's `hero.image` frontmatter natively supports `dark`/`light` keys instead of `file` for a page that wants an image pair — the homepage hero doesn't use this anymore, now that it's a video (see below), but it's the pattern to reach for if a future hero image needs one.

Not every screenshot needs a `-day` pair — skip it for one that is intentionally theme-specific regardless of docs mode, such as `kiosk-light.png` (a Latte demo in the themes guide) or `theme-picker.png` (a grid of every theme's swatch).

## Hero video

The homepage hero is a short, silent, looping recording of the real app — not a screenshot or an illustration — covering three beats: kiosk rotation (crossfade), a HUD tap to jump tabs, and a Settings drag-reorder. It has a light/dark pair like the screenshots (`night` → `mocha` app theme, `day` → `tokyo-night-day`). Generating it is a two-step pipeline:

1. **Record** — `apps/web/e2e/showcase/hero-video.spec.ts` (picked up by `bun run docs:screenshots`, same config as the screenshots) runs the three beats once per variant against the disposable e2e data file, saving raw `.webm` files to the gitignored `apps/web/e2e/.hero-raw/raw-night.webm` / `raw-day.webm`. It also:
   - Sets **both** `theme` (the app's own setting) and Playwright's `colorScheme` to match for each variant. This isn't optional cosmetic polish — the embedded fixture pages (`friendly.html`/`weather.html`) follow `prefers-color-scheme`, not the app's `theme`, so skipping `colorScheme` (as the first version of this file did) leaves the fixture content stuck on whatever the system default is regardless of which app theme is selected, which is exactly the mismatched "light dashboard content in a dark-themed app" look that prompted adding the `day` variant in the first place.
   - Points tab 2 at a second fixture (`apps/web/e2e/fixtures/weather.html`) for the duration of the recording only, since `global-setup.ts` otherwise points every seeded tab at the same `friendly.html` — without this, rotating "tabs" would show identical content. The tab's URL is restored via the API before the recording ends.
   - Enters Settings through the real HUD menu → **Settings** link (not a raw `page.goto`) and leaves through the real **Open kiosk** button — both so the navigation is actually visible on camera, and because it's load-bearing: `kioskReturn.svelte.ts` only records a "last kiosk URL" on a client-side navigation, so **Open kiosk** would fall back to popping open a new tab (breaking the recording) if entry happened via a hard reload instead.
   - Restores the tab order by dragging the reordered row back on camera, not via an invisible API call — the whole point of the reverse drag is to make the closing cut read as "the demo finished," not "the state just silently reset."
   - Ends back on the exact opening kiosk frame (tab 1, original order), so the loop is seamless by construction — no crossfade-blended seam needed. If you add a beat that can't return to that exact state, you'll need one (ffmpeg's `xfade`, applied only at that seam).
2. **Process by hand** — trim the dead loading-flash frames at the very start/end, speed up, scale down and encode with ffmpeg, once per variant. There's no one-line script for this step (picking exact trim points needs a human eye, same as reviewing screenshot diffs), but the recipe that produced the committed files:

   ```bash
   ffmpeg -ss 0.55 -to 11.86 -i apps/web/e2e/.hero-raw/raw-night.webm \
     -vf "setpts=PTS/1.5,scale=640:400:flags=lanczos" -an \
     -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 \
     apps/docs/public/hero/kiosk-tour.webm

   ffmpeg -ss 0.55 -to 11.86 -i apps/web/e2e/.hero-raw/raw-night.webm \
     -vf "setpts=PTS/1.5,scale=640:400:flags=lanczos" -an \
     -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart \
     apps/docs/public/hero/kiosk-tour.mp4

   # Repeat for raw-day.webm → kiosk-tour-day.{webm,mp4}, adjusting -to/setpts if its
   # trimmed length differs enough to need a different speed factor to land near 7-8s.
   ```

   Re-extract frames (`ffmpeg -i raw-night.webm -vf fps=10 frame-%03d.png`) to find new trim points if the recorded scenes change length. Both formats are needed per variant — Safari doesn't reliably autoplay `.webm`.

The hero embeds these via `hero.image.html` (a raw-markup escape hatch Starlight's frontmatter supports), not `dark`/`light`, since a video isn't a processable image asset — so the `dark:sl-hidden`/`light:sl-hidden` toggle has to go on the `<video>` tags by hand instead of coming from Starlight's own pair-image handling:

```yaml
hero:
  image:
    html: |
      <video class="hero-video light:sl-hidden" autoplay muted loop playsinline aria-hidden="true">
        <source src="/revolveroo/hero/kiosk-tour.webm" type="video/webm" />
        <source src="/revolveroo/hero/kiosk-tour.mp4" type="video/mp4" />
      </video>
      <video class="hero-video dark:sl-hidden" autoplay muted loop playsinline aria-hidden="true">
        <source src="/revolveroo/hero/kiosk-tour-day.webm" type="video/webm" />
        <source src="/revolveroo/hero/kiosk-tour-day.mp4" type="video/mp4" />
      </video>
      <img src="/revolveroo/screenshots/kiosk.png" alt="..." class="hero-video-fallback light:sl-hidden" />
      <img src="/revolveroo/screenshots/kiosk-day.png" alt="..." class="hero-video-fallback dark:sl-hidden" />
```

`.hero-video`/`.hero-video-fallback` styling lives in `apps/docs/src/styles/revolveroo.css`: both videos are hidden and the matching static screenshot shown instead under `prefers-reduced-motion: reduce`, same mechanism as the guide screenshot pairs above.

## Previewing

```bash
bun run docs:dev      # local dev server
bun run docs:build    # what CI runs
bun run docs:preview  # serve the built site
```
