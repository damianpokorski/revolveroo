# Docs source

The markdown in this folder is the source of the [Revolveroo docs site](https://damianpokorski.github.io/revolveroo-draft/), built with Astro and Starlight from `apps/docs`. It stays plain markdown so it reads fine on GitHub and isn't tied to Astro. `apps/docs/src/content/docs` is a symlink to this folder, because Starlight hardcodes that path.

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

The site is served under a base path (`/revolveroo-draft`), and Markdown links are not prefixed automatically. Write internal links with the base included:

```md
[Displays](/revolveroo-draft/guides/displays/)
```

If the base changes (custom domain, repo rename), update `base` in `apps/docs/astro.config.mjs` and find-and-replace `/revolveroo-draft/` here.

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

## Previewing

```bash
bun run docs:dev      # local dev server
bun run docs:build    # what CI runs
bun run docs:preview  # serve the built site
```
