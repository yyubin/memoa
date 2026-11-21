<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { listDecks, deckCounts, todayLogs, totalExp, updateSettings, type DeckCounts } from '../lib/api'
  import { me, loadProfile } from '../lib/profile.svelte'
  import { deckSettings } from '../lib/kinds'
  import { go } from '../lib/router.svelte'
  import { toast, errorText } from '../lib/toast.svelte'
  import { getJob, type JobId } from '../lib/jobs'
  import { levelFromExp, expForRating } from '../lib/levels'
  import type { Deck } from '../lib/types'
  import JobArt from '../components/JobArt.svelte'
  import JobPicker from '../components/JobPicker.svelte'
  import DeckSheet from '../components/DeckSheet.svelte'
  import Icon from '../components/Icon.svelte'
  import { lastSeenLevel, markLevelSeen } from '../lib/levelSeen'

  let decks = $state<Deck[]>([])
  let counts = $state<Record<string, DeckCounts>>({})
  const profile = $derived(me.profile)
  let exp = $state<number | null>(null)
  let todayExp = $state(0)

  let jobOpen = $state(false)
  let deckOpen = $state(false)
  let deckAdding = $state(false)

  const job = $derived(getJob(profile?.settings.job))
  const mainDeck = $derived(decks.find((d) => d.id === profile?.settings.mainDeck) ?? decks[0])
  const mainCounts = $derived(mainDeck ? counts[mainDeck.id] : undefined)
  const info = $derived(levelFromExp(exp ?? 0))
  const fmt = (n: number) => n.toLocaleString('en-US')

  let art = $state<ReturnType<typeof JobArt> | null>(null)

  // 지난번보다 레벨이 올랐으면 메인 화면에 돌아왔을 때 레벨업 연출 (기기별로 한 번)
  $effect(() => {
    const id = profile?.id
    if (exp === null || !id || !job) return
    const level = info.level
    const seen = lastSeenLevel(id)
    markLevelSeen(id, level)
    if (seen !== null && level > seen) {
      setTimeout(() => {
        art?.play('lvup')
        toast(`✦ LEVEL UP! lv. ${level}`)
      }, 450)
    }
  })

  async function load() {
    // EXP 는 따로 — 실패해도 나머지 화면은 뜨도록
    totalExp().then((v) => (exp = v)).catch((e) => toast(errorText(e), 'error'))
    try {
      const [d, p, logs] = await Promise.all([listDecks(), loadProfile(true), todayLogs()])
      decks = d
      todayExp = logs.reduce((s, l) => s + expForRating(l.rating), 0)
      if (!getJob(p.settings.job)) jobOpen = true
      const entries = await Promise.all(d.map(async (deck) => [deck.id, await deckCounts(deck.id)] as const))
      counts = Object.fromEntries(entries)
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  async function pickJob(id: JobId) {
    try {
      const settings = await updateSettings({ job: id })
      if (me.profile) me.profile.settings = settings
    } catch (e) {
      toast(errorText(e), 'error')
      throw e
    }
  }

  async function setMain(id: string) {
    const p = me.profile
    if (!p) return
    const prev = p.settings.mainDeck
    p.settings.mainDeck = id
    try {
      await updateSettings({ mainDeck: id })
    } catch (e) {
      p.settings.mainDeck = prev
      toast(errorText(e), 'error')
    }
  }

  function openDecks(adding = false) {
    deckAdding = adding
    deckOpen = true
  }

  async function switchToJob() {
    deckOpen = false
    await tick()
    jobOpen = true
  }

  /** 지금 공부할 게 가장 많은 단어장 (복습 + 오늘 들어올 새 카드). 동점이면 메인 단어장 */
  function questDeck(): Deck | null {
    let best: Deck | null = null
    let bestScore = 0
    const ordered = mainDeck ? [mainDeck, ...decks.filter((d) => d.id !== mainDeck.id)] : decks
    for (const d of ordered) {
      const c = counts[d.id]
      if (!c) continue
      const score = c.due + Math.min(c.newCards, deckSettings(d).newPerDay)
      if (score > bestScore) {
        best = d
        bestScore = score
      }
    }
    return best
  }

  function quest() {
    if (!decks.length) return openDecks(true)
    // 카운트를 아직 못 불러왔으면 메인 단어장으로
    if (decks.some((d) => !counts[d.id])) return go(`/deck/${mainDeck!.id}/study`)
    const d = questDeck()
    if (d) go(`/deck/${d.id}/study`)
    else toast('✦ 오늘 퀘스트 완료! 새 단어를 넣어볼까요?')
  }

  /** 단어장이 없으면 먼저 만들게 한다 */
  function withDeck(path: (d: Deck) => string) {
    if (mainDeck) go(path(mainDeck))
    else openDecks(true)
  }

  onMount(load)
</script>

<div class="home">
  <header class="top">
    <button class="sq" type="button" aria-label="단어장 메뉴" onclick={() => openDecks()}>
      <Icon name="grid" size={26} />
    </button>
    <div class="title-wrap">
      <div class="app">{mainDeck ? mainDeck.name : 'Memoa'}</div>
      <div class="sub">{todayExp > 0 ? `오늘 +${fmt(todayExp)} exp ↑` : 'lvl up ↑'}</div>
    </div>
    <a class="avatar" href="#/me" aria-label="내 정보">
      <Icon name="smile" size={30} />
    </a>
  </header>

  <section class="stage">
    <button
      class="hero"
      type="button"
      onclick={() => (job ? art?.play('act') : (jobOpen = true))}
      aria-label={job ? `${job.ko} 동작 보기` : '직업 고르기'}
    >
      <JobArt bind:this={art} job={job?.id} size="100%" sparkles animated={!!job} />
    </button>
  </section>

  <section class="status">
    <h1 class="job">
      {job ? job.name : profile ? 'Novice' : ' '}
      {#if job}<button class="swap" type="button" onclick={() => (jobOpen = true)} aria-label="직업 바꾸기" title="직업 바꾸기">↻</button>{/if}
    </h1>
    <p class="lv">
      lv. {exp === null ? '–' : info.level}
      <span class="small">({exp === null ? '…' : fmt(info.exp)} exp)</span>
    </p>

    <div
      class="bar"
      role="progressbar"
      aria-label="다음 레벨까지 경험치"
      aria-valuemin={info.curLevelExp}
      aria-valuemax={info.nextLevelExp}
      aria-valuenow={info.exp}
    >
      <span class="fill" style:width={`${Math.round(info.progress * 1000) / 10}%`}></span>
    </div>
    <div class="ends">
      <span>{fmt(info.curLevelExp)} exp</span>
      <span>{info.maxed ? 'MAX' : `${fmt(info.nextLevelExp)} exp`}</span>
    </div>
  </section>

  <button class="cta" type="button" onclick={() => withDeck((d) => `/deck/${d.id}/study`)}>
    <svg class="spark" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -9 Q1.4 -1.4 9 0 Q1.4 1.4 0 9 Q-1.4 1.4 -9 0 Q-1.4 -1.4 0 -9Z" /></svg>
    <span>Increase level</span>
    <svg class="spark" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -9 Q1.4 -1.4 9 0 Q1.4 1.4 0 9 Q-1.4 1.4 -9 0 Q-1.4 -1.4 0 -9Z" /></svg>
  </button>
  <p class="hint">
    {#if mainDeck}
      {mainDeck.emoji} {mainDeck.name} 공부하기 · 복습 {mainCounts?.due ?? '–'} · 새 카드 {mainCounts?.newCards ?? '–'}
    {:else if profile}
      단어장을 만들면 모험이 시작돼요
    {:else}
      &nbsp;
    {/if}
  </p>

  <nav class="actions" aria-label="바로가기">
    <div class="act">
      <button class="pill" type="button" aria-label="퀘스트 — 지금 공부할 카드가 가장 많은 단어장 공부하기" onclick={quest}>
        <Icon name="sword" size={32} />
      </button>
      <span class="cap" aria-hidden="true">퀘스트</span>
    </div>
    <div class="act">
      <button class="pill" type="button" aria-label="단어 추가" onclick={() => withDeck((d) => `/deck/${d.id}/add`)}>
        <Icon name="potion" size={32} />
      </button>
      <span class="cap" aria-hidden="true">단어 추가</span>
    </div>
    <div class="act">
      <button class="pill" type="button" aria-label="단어장 열기" onclick={() => withDeck((d) => `/deck/${d.id}`)}>
        <Icon name="key" size={32} />
      </button>
      <span class="cap" aria-hidden="true">단어장</span>
    </div>
  </nav>
</div>

<JobPicker bind:open={jobOpen} current={job?.id} required={!!profile && !job} onpick={pickJob} />
<DeckSheet
  bind:open={deckOpen}
  bind:adding={deckAdding}
  {decks}
  {counts}
  mainId={mainDeck?.id}
  onmain={setMain}
  onjob={switchToJob}
/>

<style>
  .home {
    max-width: 430px;
    margin: 0 auto;
    min-height: calc(100dvh - 44px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
  }

  /* 상단 바 */
  .top { display: grid; grid-template-columns: 46px 1fr 46px; align-items: center; gap: 8px; }
  .sq, .avatar {
    width: 46px; height: 46px; display: grid; place-items: center; padding: 0;
    border: 2.5px solid var(--line); cursor: pointer; color: var(--ink); text-decoration: none;
  }
  .sq { border-radius: 14px; background: var(--card); }
  .avatar { border-radius: 50%; background: var(--ink); color: var(--bg); }
  .sq:active, .avatar:active { transform: scale(.94); }
  .title-wrap { text-align: center; min-width: 0; line-height: 1.25; }
  .app {
    font-family: var(--font-title); font-size: 14px; text-transform: uppercase; letter-spacing: .04em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sub { font-family: var(--font-mono); font-size: 12px; }

  /* 캐릭터 */
  .stage { flex: 1; display: grid; place-items: center; padding: 8px 0 4px; min-height: 0; }
  .hero {
    width: min(100%, 330px, 42dvh); padding: 0; border: none; background: none; cursor: pointer;
    border-radius: 24px; -webkit-tap-highlight-color: transparent;
  }
  .hero:active { transform: scale(.98); }

  /* 직업 / 레벨 */
  .status { text-align: center; }
  .job { font-family: var(--font-title); font-size: 32px; line-height: 1.1; letter-spacing: -.01em; }
  .lv { margin: 4px 0 0; font-family: var(--font-mono); font-size: 16px; font-weight: 700; }
  .lv .small { font-size: 12px; font-weight: 400; }
  .bar {
    margin-top: 18px; height: 20px; padding: 2px;
    border: 2.5px solid var(--line); border-radius: 999px; background: var(--card); overflow: hidden;
  }
  .fill { display: block; height: 100%; min-width: 0; border-radius: 999px; background: var(--ink); transition: width .6s ease; }
  .ends { display: flex; justify-content: space-between; margin-top: 6px; font-family: var(--font-mono); font-size: 12px; }

  /* 큰 버튼 */
  .cta {
    margin-top: 18px; width: 100%; height: 62px; padding: 0 22px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    border: 2.5px solid var(--line); border-radius: 999px; background: var(--ink); color: var(--bg); cursor: pointer;
    font-family: var(--font-title); font-size: 17px; text-transform: uppercase; letter-spacing: .06em;
    transition: transform .08s ease;
  }
  .cta:active { transform: scale(.98); }
  .spark { width: 18px; height: 18px; fill: currentColor; flex: none; }
  .hint {
    margin: 8px 0 0; text-align: center; font-size: 12px; color: var(--ink-soft);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  /* 원형 버튼 3개 */
  .actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; }
  .act { display: grid; justify-items: center; gap: 4px; }
  .pill {
    width: 100%; height: 66px; display: grid; place-items: center; padding: 0;
    border: 2.5px solid var(--line); border-radius: 999px; background: var(--card); color: var(--ink); cursor: pointer;
    transition: transform .08s ease;
  }
  .pill:active { transform: scale(.95); }
  .cap { font-size: 12px; font-weight: 700; }

  @media (prefers-reduced-motion: reduce) {
    .fill { transition: none; }
  }
  .swap {
    vertical-align: middle; margin-left: 4px; width: 30px; height: 30px; padding: 0;
    border: 2px solid var(--line); border-radius: 50%; background: var(--card); color: var(--ink);
    font-size: 16px; line-height: 1; cursor: pointer;
  }
  .swap:active { transform: scale(.92); }
</style>
