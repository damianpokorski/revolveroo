import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// Served from https://damianpokorski.github.io/revolveroo-draft/ (GitHub Pages project site), so
// every internal link and asset must live under `base`. Drop `base` if a custom domain is added.
export default defineConfig({
  site: "https://damianpokorski.github.io",
  base: "/revolveroo-draft",
  integrations: [
    starlight({
      title: "Revolveroo",
      description: "A self-hosted kiosk that rotates through your dashboards.",
      favicon: "/favicon.svg",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/damianpokorski/revolveroo-draft",
        },
      ],
      customCss: ["./src/styles/revolveroo.css"],
      // `autogenerate.directory` matches the on-disk numbered folder names inside .articles/,
      // not the published slug (numeric prefixes are stripped in content.config.ts).
      sidebar: [
        {
          label: "Getting started",
          items: [{ autogenerate: { directory: "01-getting-started" } }],
        },
        {
          label: "Guides",
          items: [{ autogenerate: { directory: "02-guides" } }],
        },
        {
          label: "Concepts",
          items: [{ autogenerate: { directory: "03-concepts" } }],
        },
        {
          label: "Reference",
          items: [{ autogenerate: { directory: "04-reference" } }],
        },
      ],
    }),
  ],
});
