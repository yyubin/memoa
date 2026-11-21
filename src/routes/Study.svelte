<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import { getDeck, listNotes, listCards, todayLogs, totalExp, writeReview, undoReview, setSuspended, markLeech, dayEnd, type ReviewWrite } from '../lib/api'
  import { levelFromExp, expForRating } from '../lib/levels'
  import { markLevelSeen } from '../lib/levelSeen'
  import LevelUpOverlay from '../components/LevelUpOverlay.svelte'
  import { loadProfile } from '../lib/profile.svelte'
  import { deckSettings, KINDS, becameLeech, lapsesOf, LEECH_TAG } from '../lib/kinds'
  import { StudyQueue } from '../lib/session'
  import { buildQuestion, gradeTyped, suggestGrade, speak, type Question, type TypedVerdict } from '../lib/quiz'
  import { reviewCard, previewIntervals, formatInterval, setUserWeights, type Grade } from '../lib/fsrs'
  import { toast, errorText } from '../lib/toast.svelte'
  import type { CardRow, Deck, DeckSettings, SentenceData, VocabData } from '../lib/types'
  import TopBar from '../components/TopBar.svelte'
  import MyChar from '../components/MyChar.svelte'
  import Sentence from '../components/Sentence.svelte'

  let { deckId }: { deckId: string } = $props()

  let deck = $state<Deck | null>(null)
  let queue: StudyQueue | null = null
  let card = $state<CardRow | null>(null)
  let q = $state<Question | null>(null)
  let revealed = $state(false)
  let chosen = $state<number | null>(null)
  let typed = $state('')
  let verdict = $state<TypedVerdict | null>(null)
  let suggested = $state<Grade | null>(null)
  let intervals = $state<Record<Grade, string> | null>(null)
  let counts = $state({ learn: 0, review: 0, fresh: 0 })
  let doneToday = $state(0)
  let loading = $state(true)
  let saving = $state(false)
  let finished = $state(false)
  let nextAt = $state<Date | null>(null)
  let startedAt = 0
  let undoStack: { w: ReviewWrite; touched: boolean; leechSuspended: boolean }[] = []
  let settings: DeckSettings | null = null
  /** 전체 EXP (null = 아직 모름 → 레벨업 연출 생략) */
  let exp: number | null = null
  let userId = ''
  let levelUp = $state<number | null>(null)
  let typeInput = $state<HTMLInputElement | null>(null)
  let timer: ReturnType<typeof setInterval> | undefined

  // 색 대신 기호 + 테두리 스타일로 구분 (다시=점선 ✗, 어려워=△, 알맞아=○, 쉬워=◎)
  const GRADES: { g: Grade; label: string; face: string; cls: string }[] = [
    { g: 1, label: '다시', face: '✗', cls: 'again' },
    { g: 2, label: '어려워', face: '△', cls: 'hard' },
    { g: 3, label: '알맞아', face: '○', cls: 'good' },
    { g: 4, label: '쉬워', face: '◎', cls: 'easy' },
  ]

  async function load() {
    try {
      const [d, notes, cards, logs, profile] = await Promise.all([getDeck(deckId), listNotes(deckId), listCards(deckId), todayLogs(), loadProfile()])
      // 개인 최적화된 FSRS 매개변수가 있으면 사용
      setUserWeights(profile.settings.fsrs?.weights)
      userId = profile.id
      // EXP 는 레벨업 연출용이라 실패해도 복습은 계속
      totalExp().then((v) => (exp = v)).catch(() => (exp = null))
      deck = d
      settings = deckSettings(d)
      queue = new StudyQueue(cards, notes, logs, settings, dayEnd())
      doneToday = logs.filter((l) => notes.some((n) => n.id === l.note_id)).length
      await advance()
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      loading = false
    }
  }

  async function advance() {
    if (!queue) return
    counts = queue.counts()
    const next = queue.next()
    revealed = false
    chosen = null
    typed = ''
    verdict = null
    suggested = null
    intervals = null
    if (!next) {
      card = null
      q = null
      finished = true
      nextAt = queue.nextLearningAt()
      return
    }
    finished = false
    card = next
    q = buildQuestion(next, queue.note(next), queue.allNotes())
    startedAt = performance.now()
    if (q.kind === 'listen') speak(word())
    await tick()
    typeInput?.focus()
  }

  function word() {
    return q && q.note.type === 'vocab' ? (q.note.data as VocabData).word : ''
  }

  async function reveal() {
    if (!card || !q || revealed) return
    const elapsed = performance.now() - startedAt
    if (q.mode === 'choice') suggested = suggestGrade(chosen === q.answerIdx, elapsed)
    else if (q.mode === 'type') {
      verdict = gradeTyped(typed, q)
      suggested = suggestGrade(verdict, elapsed)
    }
    revealed = true
    if (q.note.type === 'vocab' && q.kind !== 'listen') speak(word())
    intervals = await previewIntervals(card)
  }

  function choose(i: number) {
    if (revealed || !q) return
    chosen = i
    reveal()
  }

  async function rate(g: Grade) {
    if (!card || !queue || saving || !revealed) return
    saving = true
    const before = card
    try {
      const next = await reviewCard(before, g)
      const w: ReviewWrite = {
        card: before,
        next,
        rating: g,
        durationMs: performance.now() - startedAt,
        logId: crypto.randomUUID(),
      }
      const touched = queue.wasTouched(before)
      await writeReview(w)
      queue.applyReview(before, next)
      const leechSuspended = await checkLeech(before, next)
      undoStack.push({ w, touched, leechSuspended })
      gainExp(g)
      doneToday++
      await advance()
    } catch (e) {
      toast('저장 실패: ' + errorText(e), 'error')
    } finally {
      saving = false
    }
  }

  function gainExp(g: Grade) {
    if (exp === null) return
    const before = levelFromExp(exp).level
    exp += expForRating(g)
    const after = levelFromExp(exp).level
    if (after > before) {
      levelUp = after
      if (userId) markLevelSeen(userId, after)
    }
  }

  /** 이번 평가로 '어려운 카드'가 됐으면 태그를 붙이고 (설정에 따라) 숨김. 숨겼으면 true */
  async function checkLeech(before: CardRow, next: Pick<CardRow, 'fsrs'>): Promise<boolean> {
    if (!queue || !settings) return false
    if (!becameLeech(lapsesOf(before.fsrs), lapsesOf(next.fsrs), settings.leechThreshold)) return false
    const note = queue.note(before)
    const suspend = settings.leechAction === 'suspend'
    try {
      await markLeech(note.id, before.id, suspend)
      if (!note.tags.includes(LEECH_TAG)) note.tags = [...note.tags, LEECH_TAG]
      if (suspend) queue.suspend(before.id)
      toast(suspend ? `⚠ "${note.word}" 은(는) 어려운 카드라 잠시 숨겼어요` : `⚠ "${note.word}" 을(를) 어려운 카드로 표시했어요`)
      return suspend
    } catch (e) {
      toast(errorText(e), 'error')
      return false
    }
  }

  async function undo() {
    const last = undoStack.pop()
    if (!last || !queue || saving) return
    saving = true
    try {
      await undoReview(last.w)
      if (last.leechSuspended) await setSuspended(last.w.card.id, false)
      if (exp !== null) exp -= expForRating(last.w.rating)
      queue.undo(last.w.card as CardRow, last.touched)
      doneToday--
      await advance()
      toast('되돌렸어요 ↩️')
    } catch (e) {
      undoStack.push(last)
      toast(errorText(e), 'error')
    } finally {
      saving = false
    }
  }

  async function suspend() {
    if (!card || !queue) return
    try {
      await setSuspended(card.id, true)
      queue.suspend(card.id)
      toast('이 유형은 더 이상 안 나와요')
      await advance()
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.isComposing || loading) return
    if (levelUp !== null) {
      // 레벨업 화면이 떠 있는 동안 키 입력은 닫기에만 씀
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); levelUp = null }
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); return }
    const inInput = e.target instanceof HTMLInputElement
    if (!revealed) {
      if (q?.mode === 'choice' && /^[1-4]$/.test(e.key)) { choose(+e.key - 1); return }
      if (e.key === 'Enter' || (e.key === ' ' && !inInput && q?.mode === 'flip')) { e.preventDefault(); reveal() }
      return
    }
    if (/^[1-4]$/.test(e.key)) rate(+e.key as Grade)
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rate(suggested ?? 3) }
  }

  const VERDICT_TEXT: Record<TypedVerdict, string> = {
    correct: '✓ 정답!',
    close: '△ 아깝다! 철자 한 글자 차이',
    synonym: '≈ 유의어예요! 하지만 정답은 따로 있어요',
    wrong: '✗ 틀렸어요',
  }

  onMount(() => {
    load()
    // 학습 중 카드가 다시 나올 시간이 되면 자동으로 이어서
    timer = setInterval(() => {
      if (finished && nextAt && nextAt.getTime() <= Date.now()) advance()
    }, 15000)
  })
  onDestroy(() => clearInterval(timer))
</script>

<svelte:window onkeydown={onKey} />

{#if levelUp !== null}
  <LevelUpOverlay level={levelUp} onclose={() => (levelUp = null)} />
{/if}

<TopBar back={`/deck/${deckId}`} title={deck ? `${deck.emoji} ${deck.name}` : ''}>
  <button class="btn small" onclick={undo} disabled={saving} aria-label="되돌리기" title="되돌리기 (Ctrl+Z)">↩️</button>
</TopBar>

{#if loading}
  <div class="center"><MyChar size={110} /></div>
{:else if finished}
  <div class="done box pop">
    <MyChar size={170} sparkles={!nextAt} />
    {#if nextAt}
      <h2>잠깐 쉬어가요 ☕</h2>
      <p>방금 배운 카드를 <b>{formatInterval(nextAt.getTime() - Date.now())}</b> 뒤에 다시 볼게요.<br />이 화면을 켜두면 자동으로 이어져요.</p>
    {:else}
      <h2>오늘 공부 끝! ✦</h2>
      <p>오늘 <b>{doneToday}</b>장을 모았어요. 내일 또 만나요!</p>
    {/if}
    <div class="row center-row">
      <a class="btn" href={`#/deck/${deckId}`}>단어장으로</a>
      <a class="btn mint" href={`#/deck/${deckId}/add`}>단어 더 넣기</a>
    </div>
  </div>
{:else if q && card}
  <div class="row counts">
    <span class="chip c-new">새 {counts.fresh}</span>
    <span class="chip c-learn">학습 {counts.learn}</span>
    <span class="chip c-review">복습 {counts.review}</span>
    <span class="spacer"></span>
    {#if q.note.tags.includes(LEECH_TAG)}<span class="chip leech" title="자주 까먹는 단어예요. 예문을 다시 읽거나 뜻을 고쳐보세요">⚠ 어려운 카드</span>{/if}
    <span class="chip kind">{KINDS[q.kind].emoji} {KINDS[q.kind].label}</span>
  </div>

  {#key card.id}
    <article class="qcard box pop">
      <!-- ───── 문제 ───── -->
      {#if q.note.type === 'vocab'}
        {@const d = q.note.data as VocabData}
        {#if q.kind === 'meaning_ko' || q.kind === 'meaning_en'}
          <div class="headword">
            <span class="title w">{d.word}</span>
            <button class="btn ghost small" onclick={() => speak(d.word)} aria-label="발음 듣기">🔊</button>
          </div>
          {#if d.ipa}<div class="muted ipa">{d.ipa}</div>{/if}
          <p class="ask muted">{q.kind === 'meaning_ko' ? '무슨 뜻일까요?' : 'What does it mean in English?'}</p>
        {:else if q.kind === 'recall'}
          <p class="ask muted">어떤 단어일까요?</p>
          {#each d.senses as s}
            <div class="clue"><span class="chip">{s.pos}</span> <b>{s.ko}</b><div class="muted en">{s.en}</div></div>
          {/each}
        {:else if q.kind === 'listen'}
          <p class="ask muted">듣고 철자를 써보세요</p>
          <button class="btn butter speak" onclick={() => speak(d.word)}>🔊 다시 듣기</button>
        {:else if q.kind === 'synonym'}
          {#if q.example && q.span}
            <p class="passage"><Sentence text={q.example.en} span={q.span} /></p>
            <p class="ask">The word <mark class="hw">{q.example.en.slice(q.span[0], q.span[1])}</mark> in the passage is closest in meaning to</p>
          {:else}
            <p class="ask">The word <mark class="hw">{d.word}</mark> is closest in meaning to</p>
          {/if}
        {:else if q.kind === 'antonym'}
          <p class="ask"><mark class="hw">{d.word}</mark> 의 반대말은?</p>
          {#if q.sense}<p class="muted small">({q.sense.pos} {q.sense.ko})</p>{/if}
        {:else if q.kind === 'cloze'}
          {#if q.example && q.span}
            <p class="passage"><Sentence text={q.example.en} span={q.span} blank /></p>
            <p class="muted small">{q.example.ko}</p>
          {/if}
          {#if q.sense}<p class="muted small">힌트: {q.sense.pos} {q.sense.ko}</p>{/if}
        {/if}
      {:else}
        {@const s = q.note.data as SentenceData}
        {#if q.kind === 'sent_ko'}
          <p class="ask muted">해석해 보세요</p>
          <p class="passage big">{s.en}</p>
        {:else}
          <p class="ask muted">영어로 말해 보세요</p>
          <p class="passage big">{s.ko}</p>
        {/if}
      {/if}

      <!-- ───── 답하기 ───── -->
      {#if q.mode === 'choice'}
        <div class="options">
          {#each q.options as opt, i}
            <button
              class="opt"
              class:right={revealed && i === q.answerIdx}
              class:wrong={revealed && chosen === i && i !== q.answerIdx}
              disabled={revealed}
              onclick={() => choose(i)}
            >
              <span class="n">{i + 1}</span>
              <span class="otext">{opt}</span>
              {#if revealed && i === q.answerIdx}<span class="mark" aria-label="정답">✓</span>
              {:else if revealed && chosen === i}<span class="mark" aria-label="오답">✗</span>{/if}
            </button>
          {/each}
        </div>
      {:else if q.mode === 'type'}
        <form class="row typerow" onsubmit={(e) => { e.preventDefault(); reveal() }}>
          <input
            class="input typein"
            class:ok={verdict === 'correct'}
            class:bad={verdict === 'wrong' || verdict === 'synonym'}
            bind:this={typeInput}
            bind:value={typed}
            disabled={revealed}
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            placeholder="정답 입력 후 Enter"
          />
          {#if !revealed}<button class="btn primary">확인</button>{/if}
        </form>
        {#if verdict}<p class="verdict">{VERDICT_TEXT[verdict]}</p>{/if}
      {/if}

      <!-- ───── 정답 ───── -->
      {#if revealed}
        <div class="answer">
          {#if q.note.type === 'vocab'}
            {@const d = q.note.data as VocabData}
            <div class="headword">
              <span class="title w small-w">{d.word}</span>
              {#if d.ipa}<span class="muted ipa">{d.ipa}</span>{/if}
              <button class="btn ghost small" onclick={() => speak(d.word)} aria-label="발음 듣기">🔊</button>
            </div>
            {#each d.senses as s, i}
              <div class="sense" class:focus={q.sense === s}>
                <div><span class="chip">{s.pos}</span> <b>{s.ko}</b></div>
                <div class="muted en">{s.en}</div>
                {#if s.synonyms.length}<div class="small">🔁 {s.synonyms.join(', ')}</div>{/if}
                {#if s.antonyms.length}<div class="small">🙃 {s.antonyms.join(', ')}</div>{/if}
                {#if (q.sense === s || (!q.sense && i === 0)) && s.examples[0]}
                  {@const ex = q.example ?? s.examples[0]}
                  <div class="ex small"><Sentence text={ex.en} span={q.example ? q.span : null} /><div class="muted">{ex.ko}</div></div>
                {/if}
              </div>
            {/each}
          {:else}
            {@const s = q.note.data as SentenceData}
            <p class="passage">{q.kind === 'sent_ko' ? s.ko : s.en}</p>
            {#if s.keyPhrases.length}<div class="small">🧷 {s.keyPhrases.join(', ')}</div>{/if}
            {#if s.source}<div class="muted small">출처: {s.source}</div>{/if}
          {/if}
        </div>
      {/if}
    </article>
  {/key}

  <!-- ───── 하단 버튼 ───── -->
  <div class="bottom">
    {#if !revealed}
      {#if q.mode === 'flip'}
        <button class="btn primary block big" onclick={reveal}>정답 보기 <small>(Space)</small></button>
      {:else if q.mode === 'choice'}
        <button class="btn ghost block" onclick={() => { chosen = -1; reveal() }}>모르겠어요 🙈</button>
      {/if}
    {:else}
      <div class="grades">
        {#each GRADES as gr}
          <button class="grade {gr.cls}" class:suggest={suggested === gr.g} onclick={() => rate(gr.g)} disabled={saving}>
            <span class="face" aria-hidden="true">{gr.face}</span>
            <span class="title">{gr.label}</span>
            <small>{intervals?.[gr.g] ?? '…'}</small>
            <span class="key" aria-hidden="true">{gr.g}</span>
          </button>
        {/each}
      </div>
      <div class="row tools">
        <a class="btn ghost small" href={`#/note/${card.note_id}`}>✏️ 고치기</a>
        <span class="spacer"></span>
        <button class="btn ghost small" onclick={suspend}>🙅 이 유형 그만 보기</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .center { display: grid; place-items: center; min-height: 50vh; }
  .counts { flex-wrap: wrap; margin-bottom: 12px; }
  .c-new { background: var(--card); }
  .c-learn { background: var(--card); border-style: dashed; }
  .c-review { background: var(--ink); color: var(--bg); }
  .kind { background: var(--card); }

  .qcard { padding: 24px 20px; display: grid; gap: 12px; min-height: 260px; align-content: start; }
  .headword { display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; }
  .w { font-size: 40px; line-height: 1.2; word-break: break-word; text-align: center; }
  .small-w { font-size: 28px; }
  .ipa { text-align: center; font-size: 15px; }
  .ask { text-align: center; font-size: 17px; margin: 4px 0; }
  .hw, :global(.qcard mark) { background: linear-gradient(transparent 55%, var(--butter) 55%); color: inherit; font-weight: 700; padding: 0 2px; }
  .passage { font-size: 18px; line-height: 1.7; margin: 0; padding: 14px 16px; background: var(--sky-soft); border-radius: 14px; }
  .passage.big { font-size: 20px; }
  .clue { text-align: center; }
  .en { font-size: 14px; }
  .small { font-size: 14px; }
  .speak { justify-self: center; }

  .options { display: grid; gap: 10px; margin-top: 6px; }
  .opt {
    display: flex; gap: 12px; align-items: center; text-align: left;
    padding: 12px 16px; font-size: 18px;
    background: var(--card); border: 2.5px solid var(--line); border-radius: 14px; cursor: pointer;
    box-shadow: 2px 2px 0 var(--line);
  }
  .opt:hover:not(:disabled) { background: var(--butter-soft); }
  .otext { flex: 1; min-width: 0; }
  .mark { font-family: var(--font-title); font-size: 20px; line-height: 1; flex: none; }
  .opt:disabled { cursor: default; color: inherit; }
  .opt .n { font-family: var(--font-title); width: 26px; height: 26px; display: grid; place-items: center; border: 2px solid var(--line); border-radius: 50%; font-size: 14px; flex: none; }
  /* 정답 = 검정으로 채운 반전, 오답 = 점선 + 취소선 + 흐리게 */
  .opt.right { background: var(--ink); color: var(--bg); box-shadow: none; }
  .opt.right .n { border-color: var(--bg); }
  .opt.wrong { border-style: dashed; box-shadow: none; opacity: .75; }
  .opt.wrong .otext { text-decoration: line-through; text-decoration-thickness: 2px; }

  .typerow { margin-top: 6px; }
  .typein { font-size: 20px; text-align: center; }
  .typein.ok { background: var(--ink); color: var(--bg); -webkit-text-fill-color: var(--bg); opacity: 1; }
  .typein.bad { border-style: dashed; text-decoration: line-through; text-decoration-thickness: 2px; opacity: 1; }
  .verdict { text-align: center; margin: 0; font-family: var(--font-title); font-size: 18px; }

  .answer { border-top: 2.5px dashed var(--ink-soft); padding-top: 14px; margin-top: 6px; display: grid; gap: 10px; }
  .sense { padding: 8px 10px; border-radius: 12px; }
  .sense.focus { background: var(--butter-soft); }
  .ex { margin-top: 6px; padding: 8px 10px; background: var(--card); border-radius: 10px; border: 1.5px solid var(--ink-soft); }

  .bottom { position: sticky; bottom: 0; padding: 14px 0 calc(8px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, var(--bg) 30%); }
  .big { padding: 14px; font-size: 20px; }
  .big small { font-size: 13px; opacity: .7; }
  .grades { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .grade {
    display: grid; justify-items: center; gap: 0; padding: 8px 4px;
    border: 2.5px solid var(--line); border-radius: 16px; cursor: pointer;
    background: var(--card); color: var(--ink); box-shadow: var(--shadow); position: relative;
    transition: transform .08s ease;
  }
  .grade:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--line); }
  .grade .face { font-family: var(--font-title); font-size: 22px; line-height: 1.2; }
  .grade .key { position: absolute; top: 4px; right: 8px; font-family: var(--font-mono); font-size: 10px; opacity: .6; }
  .grade .title { font-size: 16px; }
  .grade small { font-size: 12px; opacity: .8; }
  .grade.again { border-style: dashed; }
  /* 추천 평가 = 검정으로 채워 반전 */
  .grade.suggest { background: var(--ink); color: var(--bg); transform: translateY(-3px); }
  .tools { margin-top: 8px; }

  .done { padding: 32px 20px; text-align: center; display: grid; justify-items: center; gap: 10px; }
  .done h2 { font-size: 28px; }
  .center-row { justify-content: center; flex-wrap: wrap; }
  .leech { border-style: dashed; font-weight: 700; }
</style>
