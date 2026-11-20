<script lang="ts">
  import { toasts } from '../lib/toast.svelte'
</script>

<div class="wrap" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="toast box pop" class:error={t.tone === 'error'}>{t.text}</div>
  {/each}
</div>

<style>
  .wrap {
    position: fixed;
    left: 50%;
    bottom: calc(20px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: grid;
    gap: 8px;
    z-index: 100;
    width: min(92vw, 420px);
  }
  .toast { padding: 10px 16px; background: var(--card); font-size: 15px; text-align: center; }
  .toast.error { background: var(--ink); color: var(--bg); }
</style>
