<script lang="ts">
  /** 홈 화면용 라인 아이콘 (currentColor) */
  let { name, size = 28 }: { name: 'grid' | 'sword' | 'potion' | 'key' | 'smile'; size?: number } = $props()
</script>

<svg class="ic" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
  {#if name === 'grid'}
    <rect class="f" x="6" y="6" width="8.5" height="8.5" rx="2.6" />
    <rect class="f" x="17.5" y="6" width="8.5" height="8.5" rx="2.6" />
    <rect class="f" x="6" y="17.5" width="8.5" height="8.5" rx="2.6" />
    <rect class="f" x="17.5" y="17.5" width="8.5" height="8.5" rx="2.6" />
  {:else if name === 'sword'}
    <path class="f" d="M26.5 4.5 L27.5 5.5 L14 19 L12.5 17.5 Z" />
    <path class="s" d="M26.8 5.2 L13.3 18.7" />
    <path class="s" d="M9.5 15.5 L16.5 22.5" />
    <path class="s" d="M11.6 20.4 L6.5 25.5" />
    <circle class="f" cx="5.6" cy="26.4" r="2" />
  {:else if name === 'potion'}
    <path class="s" d="M13 4.5 h6 M14 4.5 v6 Q7 13 7 19.5 a9 9 0 0 0 18 0 Q25 13 18 10.5 v-6" />
    <path class="f" d="M8.4 19 Q12 17 16 19 T23.6 19 Q24 25.6 16 27.4 Q8 25.6 8.4 19 Z" />
    <circle class="b" cx="13" cy="22.5" r="1.4" />
    <circle class="b" cx="18.5" cy="21.5" r="1" />
  {:else if name === 'key'}
    <circle class="s" cx="10" cy="10" r="5.5" />
    <circle class="f" cx="10" cy="10" r="1.8" />
    <path class="s" d="M14 14 L27 27 M21 21 l-3 3 M24.5 24.5 l-3 3" />
  {:else if name === 'smile'}
    <circle class="f" cx="11.5" cy="12.5" r="2.4" />
    <circle class="f" cx="20.5" cy="12.5" r="2.4" />
    <path class="s" d="M9 18 Q16 25.5 23 18" />
  {/if}
</svg>

<style>
  .ic { display: block; flex: none; }
  .s { fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
  .f { fill: currentColor; stroke: currentColor; stroke-width: 1.2; stroke-linejoin: round; }
  .b { fill: var(--card); }
</style>
