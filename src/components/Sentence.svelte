<script lang="ts">
  /** 예문 출력 — 단어 위치를 강조하거나 빈칸으로 가림 (HTML 주입 없이 텍스트로만 렌더링) */
  let { text, span = null, blank = false }: { text: string; span?: [number, number] | null; blank?: boolean } = $props()
</script>

{#if span}
  {text.slice(0, span[0])}{#if blank}<span class="blank">{'＿'.repeat(Math.max(3, Math.min(8, span[1] - span[0])))}</span>{:else}<mark>{text.slice(span[0], span[1])}</mark>{/if}{text.slice(span[1])}
{:else}
  {text}
{/if}

<style>
  mark {
    background: linear-gradient(transparent 55%, var(--butter) 55%);
    color: inherit;
    font-weight: 700;
    padding: 0 2px;
  }
  .blank { color: var(--peach); font-weight: 700; letter-spacing: -2px; }
</style>
