<script lang="ts">
  import type { Snippet } from 'svelte'

  let { back, title, children }: { back?: string; title?: string; children?: Snippet } = $props()
</script>

<header class="row">
  {#if back}
    <a class="btn small" href={'#' + back} aria-label="뒤로">←</a>
  {/if}
  {#if title}<h2 class="t">{title}</h2>{/if}
  <span class="spacer"></span>
  {@render children?.()}
</header>

<style>
  header { margin-bottom: 18px; min-height: 44px; }
  .t { font-size: 24px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
