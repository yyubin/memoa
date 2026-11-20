<script lang="ts">
  import { onMount } from 'svelte'
  import { listDecks, deckCounts, createDeck, getProfile, todayLogs, type DeckCounts } from '../lib/api'
  import { go } from '../lib/router.svelte'
  import { toast, errorText } from '../lib/toast.svelte'
  import type { Deck, Profile } from '../lib/types'
  import Mascot from '../components/Mascot.svelte'

  let decks = $state<Deck[]>([])
  let counts = $state<Record<string, DeckCounts>>({})
  let profile = $state<Profile | null>(null)
  let reviewedToday = $state(0)
  let loading = $state(true)
  let adding = $state(false)
  let newName = $state('')
  let newEmoji = $state('📚')

  const EMOJIS = ['📚', '🌱', '🔬', '🏛️', '🌍', '🎧', '💬', '⭐']

  const greetings = [
    '오늘도 단어 모으러 왔구나!',
    '생선 모으듯 단어도 모아보자 🐟',
    '조금씩 꾸준히가 최고야!',
    '토플 만점까지 같이 가자!',
  ]
  const greeting = greetings[Math.floor(Math.random() * greetings.length)]

  async function load() {
    try {
      const [d, p, logs] = await Promise.all([listDecks(), getProfile(), todayLogs()])
      decks = d
      profile = p
      reviewedToday = logs.length
      const entries = await Promise.all(d.map(async (deck) => [deck.id, await deckCounts(deck.id)] as const))
      counts = Object.fromEntries(entries)
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      loading = false
    }
  }

  async function addDeck(e: SubmitEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const deck = await createDeck(newName.trim(), newEmoji)
      adding = false
      newName = ''
      go(`/deck/${deck.id}`)
    } catch (err) {
      toast(errorText(err), 'error')
    }
  }

  onMount(load)
</script>

<header class="row top">
  <div class="row greet">
    <Mascot size={60} />
    <div class="bubble box">
      <b>{profile?.nickname ?? '모아친구'}</b>야, {greeting}
    </div>
  </div>
  <span class="spacer"></span>
  <a class="btn small" href="#/me" aria-label="내 정보">⚙️</a>
</header>

<section class="today box">
  <div>
    <div class="muted small">오늘 모은 카드</div>
    <div class="big title">{reviewedToday}<span class="unit">장</span></div>
  </div>
  <div class="acorns" aria-hidden="true">{'🐟'.repeat(Math.min(10, Math.ceil(reviewedToday / 10)))}</div>
</section>

<div class="row head">
  <h2>내 단어장</h2>
  <span class="spacer"></span>
  <button class="btn small" onclick={() => (adding = !adding)}>{adding ? '닫기' : '+ 새 단어장'}</button>
</div>

{#if adding}
  <form class="box newdeck stack pop" onsubmit={addDeck}>
    <div class="row emojis">
      {#each EMOJIS as em}
        <button type="button" class="em" class:on={newEmoji === em} onclick={() => (newEmoji = em)}>{em}</button>
      {/each}
    </div>
    <div class="row">
      <input class="input" placeholder="단어장 이름 (예: 토플 리딩)" maxlength="40" bind:value={newName} />
      <button class="btn primary">만들기</button>
    </div>
  </form>
{/if}

{#if loading}
  <p class="muted center">불러오는 중…</p>
{:else}
  <div class="decks">
    {#each decks as deck (deck.id)}
      {@const c = counts[deck.id]}
      <div class="deck box">
        <a class="info" href={`#/deck/${deck.id}`}>
          <span class="emoji">{deck.emoji}</span>
          <div>
            <div class="title name">{deck.name}</div>
            <div class="muted small">단어 {c?.total ?? 0}개</div>
          </div>
        </a>
        <div class="row stats">
          <span class="chip due">복습 {c?.due ?? 0}</span>
          <span class="chip new">새 카드 {c?.newCards ?? 0}</span>
          <span class="spacer"></span>
          <a class="btn primary small" href={`#/deck/${deck.id}/study`}>공부하기</a>
        </div>
      </div>
    {:else}
      <div class="box empty">
        <Mascot mood="sleep" size={64} wiggle={false} />
        <p>아직 단어장이 없어요. 하나 만들어볼까요?</p>
      </div>
    {/each}
  </div>
{/if}

<style>
  .top { margin-bottom: 18px; align-items: flex-start; }
  .greet { align-items: center; gap: 8px; }
  .bubble { padding: 10px 14px; border-radius: 16px 16px 16px 4px; font-size: 15px; max-width: 420px; }
  .today { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: var(--mint-soft); margin-bottom: 26px; }
  .big { font-size: 40px; line-height: 1; }
  .unit { font-size: 18px; margin-left: 4px; }
  .small { font-size: 13px; }
  .acorns { font-size: 20px; letter-spacing: 2px; text-align: right; max-width: 50%; }
  .head { margin-bottom: 12px; }
  .head h2 { font-size: 22px; }
  .newdeck { padding: 14px; margin-bottom: 14px; }
  .emojis { flex-wrap: wrap; gap: 6px; }
  .em { font-size: 22px; border: 2px solid transparent; background: none; border-radius: 12px; padding: 4px 6px; cursor: pointer; }
  .em.on { border-color: var(--line); background: var(--butter-soft); }
  .decks { display: grid; gap: 14px; }
  .deck { padding: 16px; display: grid; gap: 12px; }
  .info { display: flex; align-items: center; gap: 12px; text-decoration: none; }
  .emoji { font-size: 34px; width: 52px; height: 52px; display: grid; place-items: center; background: var(--peach-soft); border-radius: 16px; border: 2.5px solid var(--line); }
  .name { font-size: 20px; }
  .stats { flex-wrap: wrap; }
  .chip.due { background: var(--sky-soft); }
  .chip.new { background: var(--mint-soft); }
  .empty { padding: 28px; text-align: center; display: grid; justify-items: center; }
  .center { text-align: center; }
</style>
