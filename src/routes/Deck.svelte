<script lang="ts">
  import { onMount } from 'svelte'
  import { getDeck, listNotes, updateDeck, deleteDeck, deckCounts, type DeckCounts } from '../lib/api'
  import { ALL_KINDS, KINDS, deckSettings, LEECH_TAG } from '../lib/kinds'
  import { go } from '../lib/router.svelte'
  import { toast, errorText } from '../lib/toast.svelte'
  import type { CardKind, Deck, DeckSettings, Note, SentenceData, VocabData } from '../lib/types'
  import TopBar from '../components/TopBar.svelte'
  import MyChar from '../components/MyChar.svelte'

  let { id }: { id: string } = $props()

  let deck = $state<Deck | null>(null)
  let notes = $state<Note[]>([])
  let counts = $state<DeckCounts | null>(null)
  let q = $state('')
  let showSettings = $state(false)
  let onlyLeech = $state(false)

  const leechCount = $derived(notes.filter((n) => n.tags.includes(LEECH_TAG)).length)

  const filtered = $derived.by(() => {
    const s = q.trim().toLowerCase()
    const base = onlyLeech ? notes.filter((n) => n.tags.includes(LEECH_TAG)) : notes
    if (!s) return base
    return base.filter((n) => n.word.toLowerCase().includes(s) || JSON.stringify(n.data).toLowerCase().includes(s))
  })

  const MIX_OPTIONS = [
    { v: 'mix', label: '섞어서', desc: '복습 사이에 고르게 (Anki 기본)' },
    { v: 'after', label: '복습 다음', desc: '복습을 다 끝낸 뒤에' },
    { v: 'before', label: '먼저', desc: '복습보다 새 카드 먼저' },
  ] as const

  async function patchSettings(patch: Partial<DeckSettings>) {
    if (!deck) return
    deck.settings = { ...deck.settings, ...patch }
    await save()
  }

  const settings = $derived(deck ? deckSettings(deck) : null)

  function summary(n: Note) {
    if (n.type === 'sentence') return (n.data as SentenceData).ko
    const d = n.data as VocabData
    return d.senses.map((s) => `${s.pos} ${s.ko}`).join(' · ')
  }

  async function load() {
    try {
      ;[deck, notes, counts] = await Promise.all([getDeck(id), listNotes(id), deckCounts(id)])
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  async function toggleKind(k: CardKind) {
    if (!deck || !settings) return
    const kinds = settings.kinds.includes(k) ? settings.kinds.filter((x) => x !== k) : [...settings.kinds, k]
    deck.settings = { ...deck.settings, kinds }
    await save()
  }

  async function setNewPerDay(v: number) {
    if (!deck) return
    deck.settings = { ...deck.settings, newPerDay: Math.max(0, Math.min(200, v || 0)) }
    await save()
  }

  async function save() {
    if (!deck) return
    try {
      await updateDeck(deck.id, { settings: deck.settings, name: deck.name })
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  async function remove() {
    if (!deck) return
    const typed = prompt(`"${deck.name}" 단어장을 지우면 단어 ${notes.length}개와 학습 기록이 모두 사라져요.\n지우려면 단어장 이름을 입력하세요.`)
    if (typed !== deck.name) return
    try {
      await deleteDeck(deck.id)
      toast('단어장을 지웠어요')
      go('/')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  onMount(load)
</script>

<TopBar back="/" title={deck ? `${deck.emoji} ${deck.name}` : ''}>
  <button class="btn small" onclick={() => (showSettings = !showSettings)} aria-label="단어장 설정">🛠️</button>
</TopBar>

{#if deck && settings}
  {#if showSettings}
    <section class="box settings stack pop">
      <label class="field">단어장 이름
        <input class="input" maxlength="40" bind:value={deck.name} onchange={save} />
      </label>
      <label class="field">하루 새 카드 수
        <input class="input num" type="number" min="0" max="200" value={settings.newPerDay} onchange={(e) => setNewPerDay(+e.currentTarget.value)} />
      </label>
      <div>
        <div class="muted label">새 카드 순서</div>
        <div class="seg">
          {#each MIX_OPTIONS as o}
            <button class:on={settings.newMix === o.v} onclick={() => patchSettings({ newMix: o.v })} title={o.desc}>{o.label}</button>
          {/each}
        </div>
        <small class="muted">{MIX_OPTIONS.find((o) => o.v === settings.newMix)?.desc}</small>
      </div>
      <div class="leechset">
        <div class="muted label">⚠ 어려운 카드</div>
        <div class="row wrap">
          <label class="row inline">
            <input class="input num" type="number" min="3" max="30" value={settings.leechThreshold}
              onchange={(e) => patchSettings({ leechThreshold: Math.max(3, Math.min(30, +e.currentTarget.value || 8)) })} />
            <span>번 까먹으면</span>
          </label>
          <div class="seg">
            <button class:on={settings.leechAction === 'tag'} onclick={() => patchSettings({ leechAction: 'tag' })}>표시만</button>
            <button class:on={settings.leechAction === 'suspend'} onclick={() => patchSettings({ leechAction: 'suspend' })}>표시 + 숨기기</button>
          </div>
        </div>
        <small class="muted">숨긴 카드는 단어를 고친 뒤 '어려운 카드 해제'를 누르면 다시 나와요.</small>
      </div>
      <div>
        <div class="muted label">문제 유형</div>
        <div class="kinds">
          {#each ALL_KINDS as k}
            <button class="kind" class:on={settings.kinds.includes(k)} onclick={() => toggleKind(k)}>
              <span class="ke">{KINDS[k].emoji}</span>
              <span>
                <b>{KINDS[k].label}</b>
                <small>{KINDS[k].desc}</small>
              </span>
            </button>
          {/each}
        </div>
      </div>
      <button class="btn small danger" onclick={remove}>단어장 지우기</button>
    </section>
  {/if}

  <section class="actions">
    <a class="btn primary big" href={`#/deck/${id}/study`}>
      ✦ 공부하기
      {#if counts}<span class="badge">{counts.due + Math.min(counts.newCards, settings.newPerDay)}</span>{/if}
    </a>
    <a class="btn mint big" href={`#/deck/${id}/add`}>✨ 단어 추가</a>
  </section>

  <div class="row search">
    <input class="input" placeholder="🔍 단어, 뜻, 동의어 검색" bind:value={q} />
  </div>

  <div class="row count">
    <span class="muted">{filtered.length}개</span>
    <span class="spacer"></span>
    {#if leechCount > 0 || onlyLeech}
      <button class="chip filter" class:on={onlyLeech} onclick={() => (onlyLeech = !onlyLeech)} aria-pressed={onlyLeech}>⚠ 어려운 카드 {leechCount}</button>
    {/if}
  </div>

  <ul class="list">
    {#each filtered as n (n.id)}
      <li>
        <a class="item box" href={`#/note/${n.id}`}>
          <span class="w title">{n.type === 'sentence' ? '💬' : ''} {n.word}{#if n.tags.includes(LEECH_TAG)} <span class="lmark" title="어려운 카드">⚠</span>{/if}</span>
          <span class="s muted">{summary(n)}</span>
        </a>
      </li>
    {:else}
      <li class="empty">
        <MyChar size={110} />
        <p>{q ? '검색 결과가 없어요' : '비어 있어요! ✨ 단어 추가로 모아봐요'}</p>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .settings { padding: 18px; margin-bottom: 18px; }
  .num { max-width: 120px; }
  .label { font-size: 14px; margin-bottom: 8px; }
  .kinds { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
  .kind {
    display: flex; gap: 10px; align-items: center; text-align: left;
    padding: 10px 12px; border: 2px dashed var(--ink-soft); border-radius: 14px; background: var(--card);
    cursor: pointer; opacity: .55;
  }
  .kind.on { border: 2.5px solid var(--line); opacity: 1; background: var(--ink); color: var(--bg); }
  .kind.on small { color: inherit; opacity: .75; }
  .ke { font-size: 22px; }
  .kind small { display: block; color: var(--ink-soft); font-size: 12px; }
  .danger { justify-self: start; border-style: dashed; box-shadow: none; }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .big { padding: 16px; font-size: 20px; }
  .badge { background: var(--card); border: 2px solid var(--line); border-radius: 999px; padding: 0 8px; font-size: 14px; }
  .search { margin-bottom: 6px; }
  .count { font-size: 13px; margin: 6px 4px 10px; }
  .list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
  .item { display: grid; gap: 2px; padding: 12px 16px; text-decoration: none; box-shadow: 2px 2px 0 var(--line); }
  .item:hover { background: var(--peach-soft); }
  .empty :global(svg) { margin-bottom: 4px; }
  .w { font-size: 19px; }
  .s { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { text-align: center; padding: 30px; display: grid; justify-items: center; }
  .seg { display: inline-grid; grid-auto-flow: column; border: 2.5px solid var(--line); border-radius: 999px; overflow: hidden; background: var(--card); }
  .seg button { border: 0; background: transparent; padding: 7px 14px; cursor: pointer; font-size: 14px; }
  .seg button + button { border-left: 2px solid var(--line); }
  .seg button.on { background: var(--ink); color: var(--bg); font-weight: 700; }
  .leechset { display: grid; gap: 6px; }
  .wrap { flex-wrap: wrap; }
  .inline { gap: 6px; font-size: 14px; }
  .inline .num { width: 72px; }
  .filter { cursor: pointer; border-style: dashed; background: var(--card); }
  .filter.on { background: var(--ink); color: var(--bg); border-style: solid; }
  .lmark { font-size: 15px; }
</style>
