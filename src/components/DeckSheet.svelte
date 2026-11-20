<script lang="ts">
  /** 홈의 단어장 목록 시트: 단어장별 카운트, 메인 단어장 지정, 새 단어장 만들기 */
  import Sheet from './Sheet.svelte'
  import { createDeck, type DeckCounts } from '../lib/api'
  import { go } from '../lib/router.svelte'
  import { toast, errorText } from '../lib/toast.svelte'
  import type { Deck } from '../lib/types'

  let {
    open = $bindable(false),
    adding = $bindable(false),
    decks,
    counts,
    mainId,
    onmain,
    onjob,
  }: {
    open?: boolean
    adding?: boolean
    decks: Deck[]
    counts: Record<string, DeckCounts>
    mainId?: string
    onmain: (id: string) => void
    onjob: () => void
  } = $props()

  const EMOJIS = ['📚', '🌱', '🔬', '🏛️', '🌍', '🎧', '💬', '⭐']
  let newName = $state('')
  let newEmoji = $state('📚')
  let busy = $state(false)

  async function addDeck(e: SubmitEvent) {
    e.preventDefault()
    if (!newName.trim() || busy) return
    busy = true
    try {
      const deck = await createDeck(newName.trim(), newEmoji)
      newName = ''
      adding = false
      open = false
      go(`/deck/${deck.id}`)
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      busy = false
    }
  }
</script>

<Sheet bind:open title="단어장">
  <div class="list">
    {#each decks as deck (deck.id)}
      {@const c = counts[deck.id]}
      {@const isMain = deck.id === mainId}
      <div class="deck" class:main={isMain}>
        <a class="info" href={`#/deck/${deck.id}`} onclick={() => (open = false)}>
          <span class="emoji" aria-hidden="true">{deck.emoji}</span>
          <span class="txt">
            <span class="name">{deck.name}</span>
            <span class="meta">단어 {c?.total ?? 0} · 복습 {c?.due ?? 0} · 새 카드 {c?.newCards ?? 0}</span>
          </span>
        </a>
        <div class="acts">
          <button class="pin" type="button" aria-pressed={isMain} onclick={() => onmain(deck.id)} title="홈에서 바로 공부할 단어장">
            {isMain ? '★ 메인' : '☆ 메인으로'}
          </button>
          <span class="spacer"></span>
          <a class="btn small" href={`#/deck/${deck.id}/add`} onclick={() => (open = false)}>+ 단어</a>
          <a class="btn primary small" href={`#/deck/${deck.id}/study`} onclick={() => (open = false)}>공부</a>
        </div>
      </div>
    {:else}
      <p class="empty muted">아직 단어장이 없어요. 첫 단어장을 만들면 모험이 시작돼요!</p>
    {/each}
  </div>

  {#if adding || !decks.length}
    <form class="newdeck" onsubmit={addDeck}>
      <div class="emojis" role="radiogroup" aria-label="단어장 아이콘">
        {#each EMOJIS as em}
          <button type="button" class="em" class:on={newEmoji === em} role="radio" aria-checked={newEmoji === em} onclick={() => (newEmoji = em)}>{em}</button>
        {/each}
      </div>
      <div class="row">
        <input class="input" placeholder="단어장 이름 (예: 리딩 단어)" maxlength="40" aria-label="단어장 이름" bind:value={newName} />
        <button class="btn primary" disabled={busy || !newName.trim()}>만들기</button>
      </div>
    </form>
  {:else}
    <button class="btn block add" type="button" onclick={() => (adding = true)}>+ 새 단어장</button>
  {/if}

  <div class="foot">
    <button class="btn ghost small" type="button" onclick={onjob}>↻ 직업 변경</button>
    <a class="btn ghost small" href="#/me" onclick={() => (open = false)}>내 정보</a>
  </div>
</Sheet>

<style>
  .list { display: grid; gap: 10px; }
  .deck { display: grid; gap: 10px; padding: 12px; border: 2.5px solid var(--line); border-radius: 20px; background: var(--card); }
  .deck.main { box-shadow: 4px 4px 0 var(--line); }
  .info { display: flex; align-items: center; gap: 12px; text-decoration: none; min-width: 0; }
  .emoji {
    font-size: 24px; width: 44px; height: 44px; flex: none; display: grid; place-items: center;
    border: 2.5px solid var(--line); border-radius: 14px; background: var(--bg);
  }
  .txt { display: grid; min-width: 0; }
  .name { font-weight: 800; font-size: 17px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { font-family: var(--font-mono); font-size: 12px; color: var(--ink-soft); }
  .acts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .pin { border: none; background: none; padding: 4px 0; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--ink-soft); }
  .pin[aria-pressed='true'] { color: var(--ink); }
  .empty { text-align: center; margin: 4px 0 12px; word-break: keep-all; }
  .newdeck { display: grid; gap: 10px; margin-top: 14px; padding: 12px; border: 2.5px dashed var(--line); border-radius: 20px; }
  .newdeck .row { gap: 8px; }
  .newdeck .input { min-width: 0; }
  .emojis { display: flex; flex-wrap: wrap; gap: 4px; }
  .em { font-size: 20px; border: 2px solid transparent; background: none; border-radius: 12px; padding: 2px 6px; cursor: pointer; }
  .em.on { border-color: var(--line); background: var(--card); }
  .add { margin-top: 14px; }
  .foot { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
</style>
