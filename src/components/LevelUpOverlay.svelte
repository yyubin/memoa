<script lang="ts">
  /** 복습 중 레벨이 오르는 순간 잠깐 뜨는 축하 화면. 탭하거나 2.4초 뒤 사라짐 */
  import { onMount } from 'svelte'
  import JobArt from './JobArt.svelte'
  import { myJob } from '../lib/profile.svelte'

  let { level, onclose }: { level: number; onclose: () => void } = $props()

  let art = $state<ReturnType<typeof JobArt> | null>(null)
  const job = $derived(myJob())

  onMount(() => {
    requestAnimationFrame(() => art?.play('lvup'))
    const t = setTimeout(onclose, 2400)
    return () => clearTimeout(t)
  })
</script>

<button class="overlay" type="button" onclick={onclose} aria-label="레벨업! 눌러서 닫기">
  <div class="panel" role="status" aria-live="polite">
    <div class="art"><JobArt bind:this={art} job={job?.id ?? 'paladin'} size="100%" sparkles animated /></div>
    <div class="lv">lv. <b>{level}</b></div>
    <div class="who">{job ? `${job.ko}이(가) 강해졌어요!` : '한 단계 성장했어요!'}</div>
  </div>
</button>

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 90; border: 0; padding: 16px; margin: 0;
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    display: grid; place-items: center; cursor: pointer; color: var(--ink);
    animation: fade .25s ease both;
  }
  .panel {
    width: min(320px, 86vw); padding: 18px 18px 22px; display: grid; justify-items: center; gap: 4px;
    background: var(--card); border: 3px solid var(--line); border-radius: 28px; box-shadow: 5px 5px 0 var(--line);
    animation: rise .35s cubic-bezier(.2, 1.4, .4, 1) both;
  }
  .art { width: 82%; }
  .lv { font-family: var(--font-mono); font-size: 18px; }
  .lv b { font-family: var(--font-title); font-weight: 400; font-size: 34px; display: inline-block; animation: bump .6s .7s cubic-bezier(.3, 1.8, .5, 1) both; }
  .who { font-weight: 700; font-size: 15px; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes rise { from { transform: translateY(24px) scale(.94); opacity: 0; } }
  @keyframes bump { 0% { transform: scale(1); } 40% { transform: scale(1.7); } 100% { transform: scale(1); } }
  @media (prefers-reduced-motion: reduce) {
    .overlay, .panel, .lv b { animation: none; }
  }
</style>
