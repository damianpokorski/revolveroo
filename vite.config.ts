import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/.svelte-kit/**",
      "apps/web/build/**",
      "apps/web/.output/**",
      "apps/server/dist/**",
      "apps/docs/dist/**",
      "apps/docs/.astro/**",
      "local.yaml",
    ],
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/.svelte-kit/**",
      "apps/web/build/**",
      "apps/web/.output/**",
      "apps/server/dist/**",
      "apps/docs/dist/**",
      "apps/docs/.astro/**",
      "local.yaml",
    ],
    singleQuote: false,
    semi: true,
    sortPackageJson: true,
  },
});
