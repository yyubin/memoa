<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '../lib/supabase'
  import { loadProfile } from '../lib/profile.svelte'
  import { toast, errorText } from '../lib/toast.svelte'
  import { MIN_REVIEWS, canOptimizeHere, optimize, resetToDefault, type OptimizeResult } from '../lib/optimizer'
  import type { FsrsPersonal } from '../lib/types'

  let current = $state<FsrsPersonal | null>(null)
  let reviewCount = $state<number | null>(null)
  let running = $state(false)
  let progress = $state(0)
  let last = $state<OptimizeResult | null>(null)
  const supported = canOptimizeHere()

  /** log loss 개선율 (%) */
  const gain = (d: number, o: number) => (d > 0 ? Math.round(((d - o) / d) * 1000) / 10 : 0)
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  onMount(async () => {
    try {
      const [p, c] = await Promise.all([
        loadProfile(),
        supabase.from('review_logs').select('id', { count: 'exact', head: true }),
      ])
      current = p.settings.fsrs ?? null
      reviewCount = c.count ?? 0
    } catch (e) {
      toast(errorText(e), 'error')
    }
  })

  async function run() {
    running = true
    progress = 0
    last = null
    // 계산이 화면을 잠깐 멈출 수 있어서, 진행 표시가 먼저 그려지게 한 박자 쉼
    await new Promise((r) => setTimeout(r, 50))
    try {
      last = await optimize((r) => (progress = r))
      if (last.applied && last.settings) {
        current = last.settings
        await loadProfile(true)
        toast('✦ 내 기억 패턴에 맞춰 조정했어요')
      } else {
        toast('지금 기본값이 더 잘 맞아요. 그대로 둘게요')
      }
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      running = false
    }
  }

  async function reset() {
    try {
      await resetToDefault()
      await loadProfile(true)
      current = null
      last = null
      toast('기본값으로 되돌렸어요')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }
</script>

<section class="box panel stack">
  <div class="row">
    <h3>⚙ 복습 간격 맞춤 (FSRS)</h3>
    <span class="spacer"></span>
    <span class="chip" class:on={!!current}>{current ? '내 맞춤값' : '기본값'}</span>
  </div>
  <p class="muted small">
    내 복습 기록으로 "언제 까먹는지"를 다시 학습해서 복습 간격을 맞춰요. Anki의 Optimize와 같은 방식이고, 계산은 이 기기에서만 해요.
  </p>

  {#if current}
    <dl class="stats">
      <div><dt>마지막 조정</dt><dd>{fmtDate(current.optimizedAt)}</dd></div>
      <div><dt>사용한 기록</dt><dd>{current.reviewCount.toLocaleString()}개</dd></div>
      <div><dt>예측 정확도</dt><dd>{gain(current.logLossDefault, current.logLossOptimized)}% 개선</dd></div>
    </dl>
  {/if}

  {#if last && !last.applied}
    <p class="note">기본값 오차 {last.logLossDefault.toFixed(4)} · 맞춤값 오차 {last.logLossOptimized.toFixed(4)} → 개선되지 않아 적용하지 않았어요.</p>
  {/if}

  {#if running}
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress * 100)}>
      <span style:width={`${Math.max(4, progress * 100)}%`}></span>
    </div>
    <p class="muted small">계산 중… 기록이 많으면 몇십 초 걸려요</p>
  {/if}

  {#if !supported}
    <p class="note">이 브라우저에서는 계산할 수 없어요. 최신 Chrome·Safari·Firefox에서 열어주세요.</p>
  {:else if reviewCount !== null && reviewCount < MIN_REVIEWS}
    <p class="note">복습 기록이 {MIN_REVIEWS}개 쌓이면 할 수 있어요 (지금 {reviewCount}개)</p>
  {/if}

  <div class="row btns">
    <button class="btn primary" onclick={run} disabled={running || !supported || reviewCount === null || reviewCount < MIN_REVIEWS}>
      {running ? '계산 중…' : current ? '다시 맞추기' : '내 기록으로 맞추기'}
    </button>
    {#if current}<button class="btn ghost small" onclick={reset} disabled={running}>기본값으로</button>{/if}
  </div>
  <p class="muted tiny">한 달에 한 번쯤, 또는 기록이 많이 늘었을 때 다시 맞추면 좋아요.</p>
</section>

<style>
  .panel { padding: 18px; margin-bottom: 16px; }
  h3 { font-size: 20px; }
  .small { font-size: 13px; margin: 0; }
  .tiny { font-size: 12px; margin: 0; }
  .chip.on { background: var(--ink); color: var(--bg); }
  .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; }
  @media (max-width: 440px) { .stats { grid-template-columns: 1fr; } }
  .stats div { border: 2px solid var(--line); border-radius: 12px; padding: 8px 10px; }
  dt { font-size: 12px; color: var(--ink-soft); }
  dd { margin: 0; font-family: var(--font-mono); font-weight: 700; font-variant-numeric: tabular-nums; }
  .note { margin: 0; font-size: 13px; padding: 8px 12px; border: 2px dashed var(--line); border-radius: 12px; }
  .bar { height: 14px; border: 2.5px solid var(--line); border-radius: 999px; overflow: hidden; background: var(--card); }
  .bar span { display: block; height: 100%; background: var(--ink); transition: width .2s ease; }
  .btns { flex-wrap: wrap; }
</style>
