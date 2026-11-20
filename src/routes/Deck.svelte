<script lang="ts">
  import { onMount } from 'svelte'
  import { getDeck, listNotes, updateDeck, deleteDeck, deckCounts, type DeckCounts } from '../lib/api'
  import { ALL_KINDS, KINDS, deckSettings } from '../lib/kinds'
  import { go } from '../lib/router.svelte'
  import { toast, errorText } from '../lib/toast.svelte'
  import type { CardKind, Deck, Note, SentenceData, VocabData } from '../lib/types'
  import TopBar from '../components/TopBar.svelte'
  import Mascot from '../components/Mascot.svelte'

  let { id }: { id: string } = $props()

  let deck = $state<Deck | null>(null)
  let notes = $state<Note[]>([])
  let counts = $state<DeckCounts | null>(null)
  let q = $state('')
  let showSettings = $state(false)

  const filtered = $derived.by(() => {
    const s = q.trim().toLowerCase()
    if (!s) return notes
    return notes.filter((n) => n.word.toLowerCase().includes(s) || JSON.stringify(n.data).toLowerCase().includes(s))
  })

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
      🐾 공부하기
      {#if counts}<span class="badge">{counts.due + Math.min(counts.newCards, settings.newPerDay)}</span>{/if}
    </a>
    <a class="btn mint big" href={`#/deck/${id}/add`}>✨ 단어 추가</a>
  </section>

  <div class="row search">
    <input class="input" placeholder="🔍 단어, 뜻, 동의어 검색" bind:value={q} />
  </div>

  <p class="muted count">{filtered.length}개</p>

  <ul class="list">
    {#each filtered as n (n.id)}
      <li>
        <a class="item box" href={`#/note/${n.id}`}>
          <span class="w title">{n.type === 'sentence' ? '💬' : ''} {n.word}</span>
          <span class="s muted">{summary(n)}</span>
        </a>
      </li>
    {:else}
      <li class="empty">
        <Mascot mood="wow" size={60} wiggle={false} />
        <p>{q ? '검색 결과가 없어요' : '비어 있어요! ✨ 단어 추가로 모아봐요'}</p>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .settings { padding: 18px; margin-bottom: 18px; background: var(--butter-soft); }
  .num { max-width: 120px; }
  .label { font-size: 14px; margin-bottom: 8px; }
  .kinds { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
  .kind {
    display: flex; gap: 10px; align-items: center; text-align: left;
    padding: 10px 12px; border: 2px dashed var(--ink-soft); border-radius: 14px; background: var(--card);
    cursor: pointer; opacity: .55;
  }
  .kind.on { border: 2.5px solid var(--line); opacity: 1; background: var(--mint-soft); }
  .ke { font-size: 22px; }
  .kind small { display: block; color: var(--ink-soft); font-size: 12px; }
  .danger { justify-self: start; background: var(--berry-soft); }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .big { padding: 16px; font-size: 20px; }
  .badge { background: var(--card); border: 2px solid var(--line); border-radius: 999px; padding: 0 8px; font-size: 14px; }
  .search { margin-bottom: 6px; }
  .count { font-size: 13px; margin: 6px 4px 10px; }
  .list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
  .item { display: grid; gap: 2px; padding: 12px 16px; text-decoration: none; box-shadow: 2px 2px 0 var(--line); }
  .item:hover { background: var(--peach-soft); }
  .w { font-size: 19px; }
  .s { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { text-align: center; padding: 30px; display: grid; justify-items: center; }
</style>
