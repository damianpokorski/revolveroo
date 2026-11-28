---
title: Music Assistant integration
description: Turn a kiosk into a synced Music Assistant speaker, and let guests join with a QR code.
sidebar:
  order: 9
---

Revolveroo can connect to a [Music Assistant](https://www.music-assistant.io/) server in two independent ways: as a background audio player (via the [Sendspin](https://github.com/Sendspin/sendspin-js) protocol), and as a source of guest-join QR codes for Music Assistant's Party plugin. Neither requires the other — turn on whichever one you want.

## Background audio (Sendspin)

Sendspin is Music Assistant's own clock-synchronized audio protocol — the same one its built-in web player uses. Pointing a kiosk at it turns that kiosk into a real speaker: audio keeps playing continuously, independent of which tab is currently rotating on screen.

### Set it up

In **Settings → Music Assistant**, set **Server URL** to your Music Assistant server's Sendspin endpoint, for example:

```
ws://192.168.1.50:8927/sendspin
```

This is a different port from Music Assistant's main web UI/API (usually `8095`) — Sendspin has its own.

:::note
No pairing step is required. Music Assistant accepts unpaired Sendspin clients the same way it accepts its own built-in web player — there is nothing to approve on the Music Assistant side.
:::

Once set, the kiosk connects on next load and stays connected for the lifetime of that browser tab, regardless of tab rotation, HUD interaction, or navigating to Settings and back.

### Now-playing popup

While something is playing, a small popup appears showing the art (or a placeholder note icon if none is available), title, artist, and play/pause/next controls. It fades out a few seconds after playback stops, so a brief pause or track change doesn't cause it to flicker.

Choose which corner it appears in under **Settings → Music Assistant → Now-playing popup corner**.

### The "tap to enable audio" reminder

Browsers block audio from playing until a user gesture unlocks it. Revolveroo detects this automatically and shows a small prompt only when the browser actually requires it — on a kiosk running Chrome with autoplay restrictions disabled (for example, launched with `--autoplay-policy=no-user-gesture-required`), the prompt never appears at all.

If you'd rather hide this reminder entirely — for a kiosk nobody can physically tap — turn off **Settings → Music Assistant → Show "tap to enable audio" reminder**. Audio simply won't play on that kiosk until something else unlocks the browser's audio context.

### Multiple kiosks

Each kiosk registers as its own named player in Music Assistant, named after its [Display](/revolveroo/guides/displays/) (falling back to its hostname if it doesn't match one). Two kiosks that share both the same hostname and the same Display match would still collide — an unusual setup — but otherwise every kiosk shows up as a distinct player.

## Guest access QR code

Music Assistant 2.10+'s **Party plugin** lets guests scan a QR code and get a limited song-request interface, with no login. Revolveroo can fetch that join link and display it as a QR code directly on the kiosk.

This is separate from Sendspin above — it talks to Music Assistant's regular HTTP API (the `8095` port), not the Sendspin port, and needs its own token.

### Set it up

1. Enable the Party plugin in Music Assistant and make sure guest access is turned on.
2. In Music Assistant, create a long-lived API token (**Settings → Profile** in Music Assistant's own UI). A token scoped to just `providers.read` is enough — this feature only ever calls one read-only command.
3. In Revolveroo's **Settings → Music Assistant**, fill in:
   - **Guest access — API base URL**: Music Assistant's main HTTP address, for example `http://192.168.1.50:8095`.
   - **Guest access — API token**: paste the token, then click **Save token**.

:::note
The token field is write-only. Revolveroo's API never returns it once saved — not even to the kiosk's own browser — so the field always starts blank. Leaving it blank and not clicking **Save token** keeps whatever token is already stored; it does not clear it.
:::

### Using it

Once both fields are set, a **Show guest QR** action appears in the kiosk's HUD menu (tap the HUD, then the **···** button). It fetches a fresh join link each time and shows it as a QR code alongside the plain URL and a copy button. The action stays hidden until both the base URL and token are configured, so there's nothing half-working to stumble into.

If Music Assistant can't be reached, or the Party plugin isn't set up, the modal shows a plain error message instead of a broken QR.

See the [data file schema](/revolveroo/reference/data-file-schema/) for the underlying `maApiBaseUrl`/`maApiToken`/`sendspinUrl`/`nowPlayingPopupCorner`/`audioUnlockPromptEnabled` fields, and the [security model](/revolveroo/reference/security/) for how the API token is handled server-side.
