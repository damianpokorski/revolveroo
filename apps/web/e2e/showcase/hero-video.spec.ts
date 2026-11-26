import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Page, test } from "@playwright/test";
import { fetchTabs, putConfig, updateTab } from "../api";
import { FIXTURE_ORIGIN } from "../global-setup";

// Raw capture for the docs homepage hero loop. This is the ONLY step that touches a real
// browser — everything after (trim, speed up, encode) is a one-off ffmpeg pass documented in
// .articles/README.md's "Hero video" section, run by hand against the files this writes.
// Never commit the raw files directly; only the processed output under apps/docs/public/hero/.
const RAW_DIR = fileURLToPath(new URL("../.hero-raw/", import.meta.url));
mkdirSync(RAW_DIR, { recursive: true });

test.use({ video: "on" });

// The crossfade transition itself (apps/web/src/routes/+page.svelte's TAB_TRANSITION_MS).
const CROSSFADE_MS = 500;

async function waitForFrameContent(page: Page) {
  await page
    .frameLocator('[data-testid="kiosk-iframe"].active')
    .getByTestId("fixture-marker")
    .waitFor();
}

// Drags a tab row's grip handle from one position in the list to another.
async function dragRow(page: Page, fromIndex: number, toIndex: number) {
  const rows = page.getByTestId("tab-row");
  const sourceBox = await rows.nth(fromIndex).locator(".grip").boundingBox();
  const targetBox = await rows.nth(toIndex).boundingBox();
  if (!sourceBox || !targetBox) throw new Error("tab rows not visible for drag");
  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY - 15, { steps: 5 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 15,
  });
  await page.waitForTimeout(350);
  await page.mouse.up();
}

interface Variant {
  name: string;
  theme: string;
  colorScheme: "dark" | "light";
}

// One theme/colorScheme pair per committed video — colorScheme matters here because the
// embedded fixture pages (friendly.html/weather.html) follow prefers-color-scheme, not the
// app's own theme setting, so without pairing them explicitly a "light" app theme would still
// show dashboard content recorded under whatever the system default colorScheme is (previously
// unset entirely, which is exactly the mismatch that prompted adding this "day" variant).
const VARIANTS: Variant[] = [
  { name: "night", theme: "mocha", colorScheme: "dark" },
  { name: "day", theme: "tokyo-night-day", colorScheme: "light" },
];

test.describe("Hero video raw capture", () => {
  for (const variant of VARIANTS) {
    test(`kiosk rotation, HUD tap, settings reorder (${variant.name})`, async ({
      page,
      request,
    }) => {
      test.setTimeout(60_000);
      await page.emulateMedia({
        reducedMotion: "reduce",
        colorScheme: variant.colorScheme,
      });
      await putConfig(request, {
        theme: variant.theme,
        tabTransition: "crossfade",
        autoplayEnabled: true,
        playbackInterval: 1800,
        kioskControls: "expanded",
      });
      const seededTabs = await fetchTabs(request);
      // global-setup points every seeded tab at the same friendly.html fixture, so without
      // this the rotation/HUD-tap beats would show zero visual change between tabs. Swap
      // tab 2 to a distinct fixture for the recording, restored again before the loop closes.
      const secondTab = seededTabs[1];
      await updateTab(request, secondTab.id, {
        title: secondTab.title,
        url: `${FIXTURE_ORIGIN}/weather.html`,
      });

      // Scene 1: kiosk rotation — tab 1 autoplays into tab 2 on its own. Wait for the opening
      // frame's content (not just the HUD state) before the dwell, so the loop's first visible
      // frame is never a blank/loading iframe.
      await page.goto("/");
      await waitForFrameContent(page);
      await page.waitForTimeout(1300); // dwell on tab 1
      await page.waitForTimeout(1800 + CROSSFADE_MS + 200); // autoplay fires, crossfade completes
      await waitForFrameContent(page);
      await page.waitForTimeout(1300); // dwell on tab 2 (weather) so it actually registers

      // Scene 2: HUD tap — jump straight to tab 3, crossfade plays the same as autoplay would.
      await page.getByTestId("hud-cell").nth(2).click();
      await page.waitForTimeout(CROSSFADE_MS + 200);
      await waitForFrameContent(page);
      await page.waitForTimeout(700);

      // Scene 2b: a real HUD-menu → Settings navigation, not a raw page.goto — partly so the
      // interaction is visible on camera, partly because it's load-bearing: SvelteKit's
      // afterNavigate only records "last kiosk URL" (kioskReturn.svelte.ts) on a client-side
      // nav, and the "Open kiosk" button used to close the loop falls back to opening a new
      // tab entirely if that was never recorded.
      await page.getByTestId("hud-menu-toggle").click();
      await page.getByTestId("hud-settings-link").waitFor();
      await page.waitForTimeout(400);
      await page.getByTestId("hud-settings-link").click();

      // Scene 3: settings — drag the second row above the first, pause, then drag it back.
      // Reversing it on camera (rather than an invisible API restore) is what makes the loop's
      // closing cut read as "the demo finished", not "the state just silently reset".
      const rows = page.getByTestId("tab-row");
      await rows.first().waitFor();
      await dragRow(page, 1, 0);
      await page.waitForTimeout(600);
      await dragRow(page, 0, 1);
      await page.waitForTimeout(500);

      // Cut back to kiosk via the real "Open kiosk" button — a smooth client-side transition,
      // not a hard reload — closing the loop back on the exact opening frame.
      await updateTab(request, secondTab.id, {
        title: secondTab.title,
        url: `${FIXTURE_ORIGIN}/friendly.html`,
      });
      await page.getByTestId("open-kiosk-link").click();
      await waitForFrameContent(page);
      await page.waitForTimeout(600);

      await page.close();
      await page.video()?.saveAs(`${RAW_DIR}raw-${variant.name}.webm`);
    });
  }
});
