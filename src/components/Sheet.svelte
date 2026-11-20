<script lang="ts">
  /** 바텀 시트 (네이티브 <dialog> — 포커스 가두기·Esc 닫기를 브라우저가 처리) */
  import type { Snippet } from 'svelte'

  let {
    open = $bindable(false),
    title,
    dismissable = true,
    children,
  }: { open?: boolean; title: string; dismissable?: boolean; children: Snippet } = $props()

  let dlg = $state<HTMLDialogElement>()

  $effect(() => {
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    else if (!open && dlg.open) dlg.close()
  })

  function onCancel(e: Event) {
    if (!dismissable) e.preventDefault()
  }

  function onBackdrop(e: MouseEvent) {
    if (dismissable && e.target === dlg) open = false
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dlg} class="sheet" aria-label={title} oncancel={onCancel} onclose={() => (open = false)} onclick={onBackdrop}>
  <div class="inner">
    <header class="head">
      <h2>{title}</h2>
      {#if dismissable}
        <button class="x" type="button" aria-label="닫기" onclick={() => (open = false)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      {/if}
    </header>
    {@render children()}
  </div>
</dialog>

<style>
  .sheet {
    width: min(100%, 480px);
    max-width: 100%;
    max-height: min(88dvh, 760px);
    margin: auto auto 0;
    padding: 0;
    border: 2.5px solid var(--line);
    border-bottom: none;
    border-radius: 28px 28px 0 0;
    background: var(--bg);
    color: var(--ink);
    overflow: auto;
    overscroll-behavior: contain;
  }
  .sheet[open] { animation: up .22s ease-out; }
  .sheet::backdrop { background: rgb(0 0 0 / .45); }
  @media (min-width: 560px) {
    .sheet { margin: auto; border-bottom: 2.5px solid var(--line); border-radius: 28px; }
  }
  .inner { padding: 18px 16px calc(20px + env(safe-area-inset-bottom)); }
  .head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .head h2 { flex: 1; font-size: 20px; text-transform: uppercase; letter-spacing: .02em; }
  .x {
    width: 40px; height: 40px; flex: none; display: grid; place-items: center;
    border: 2.5px solid var(--line); border-radius: 12px; background: var(--card); cursor: pointer;
  }
  .x path { stroke: currentColor; stroke-width: 2.8; stroke-linecap: round; fill: none; }
  @keyframes up { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .sheet[open] { animation: none; } }
</style>
