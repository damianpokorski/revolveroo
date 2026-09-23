<!--
  The mark, for use inside the app — header, empty states, the kiosk HUD.

  Takes its colour from `currentColor`, so it themes for free:
    <span style="color: var(--rv-accent)"><RevolverooMark size={20} /></span>

  The loaded chamber is set apart by size as well as opacity, so the mark still
  reads when it lands somewhere that flattens it to one tone.

  Decorative by default. Pass a `title` only when the mark is the sole content of
  a link or button and nothing else names it.
-->
<script>
let { size = 20, title = null, ...rest } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  role={title ? 'img' : undefined}
  aria-hidden={title ? undefined : 'true'}
  {...rest}
>
  {#if title}<title>{title}</title>{/if}
  <circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="2" />
  <g fill="currentColor" opacity="0.45">
    <circle cx="16.5" cy="9.4" r="1.75" />
    <circle cx="16.5" cy="14.6" r="1.75" />
    <circle cx="12" cy="17.2" r="1.75" />
    <circle cx="7.5" cy="14.6" r="1.75" />
    <circle cx="7.5" cy="9.4" r="1.75" />
  </g>
  <circle cx="12" cy="6.8" r="2.5" fill="currentColor" />
</svg>
