<script>
  let { key, value, note } = $props();
</script>

<div class="pair">
  <code>{key}</code>
  <span class="arrow" aria-hidden="true">→</span>
  <span class="value">{value}</span>
  {#if note}<span class="muted">{note}</span>{/if}
</div>
