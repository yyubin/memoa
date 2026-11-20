<script lang="ts">
  import { onMount } from 'svelte'
  import { getNote, saveNote, deleteNote, clearLeech } from '../lib/api'
  import { LEECH_TAG } from '../lib/kinds'
  import { go } from '../lib/router.svelte'
  import { toast, errorText } from '../lib/toast.svelte'
  import type { Note, SentenceData, VocabData } from '../lib/types'
  import TopBar from '../components/TopBar.svelte'
  import VocabEditor from '../components/VocabEditor.svelte'
  import SentenceEditor from '../components/SentenceEditor.svelte'

  let { id }: { id: string } = $props()
  let note = $state<Note | null>(null)
  let busy = $state(false)

  onMount(async () => {
    try {
      note = await getNote(id)
    } catch (e) {
      toast(errorText(e), 'error')
    }
  })

  async function save() {
    if (!note) return
    busy = true
    try {
      const n = $state.snapshot(note) as Note
      await saveNote({ id: n.id, deck_id: n.deck_id, type: n.type, data: n.data, tags: n.tags })
      toast('저장했어요')
      go(`/deck/${n.deck_id}`)
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      busy = false
    }
  }

  async function unleech() {
    if (!note) return
    try {
      await clearLeech(note.id)
      note.tags = note.tags.filter((t) => t !== LEECH_TAG)
      toast('어려운 카드 표시를 뗐어요. 숨긴 카드도 다시 나와요')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  async function remove() {
    if (!note || !confirm(`"${note.word}" 을(를) 지울까요? 학습 기록도 함께 사라져요.`)) return
    try {
      await deleteNote(note.id)
      toast('지웠어요')
      go(`/deck/${note.deck_id}`)
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }
</script>

<TopBar back={note ? `/deck/${note.deck_id}` : '/'} title="단어 고치기">
  <button class="btn small danger" onclick={remove}>지우기</button>
</TopBar>

{#if note}
  {#if note.tags.includes(LEECH_TAG)}
    <section class="box leech row">
      <div>
        <b>⚠ 어려운 카드</b>
        <p class="muted small">자주 까먹는 단어예요. 뜻을 내 말로 고치거나 예문을 바꿔보면 도움이 돼요.</p>
      </div>
      <span class="spacer"></span>
      <button class="btn small" onclick={unleech}>해제</button>
    </section>
  {/if}
  <section class="box panel stack">
    {#if note.type === 'vocab'}
      <VocabEditor bind:data={note.data as VocabData} />
    {:else}
      <SentenceEditor bind:data={note.data as SentenceData} />
    {/if}
    <button class="btn mint block" onclick={save} disabled={busy}>저장</button>
  </section>
{/if}

<style>
  .panel { padding: 16px; }
  .danger { border-style: dashed; box-shadow: none; }
  .leech { padding: 12px 16px; margin-bottom: 14px; border-style: dashed; box-shadow: none; flex-wrap: wrap; }
  .leech p { margin: 2px 0 0; }
  .small { font-size: 13px; }
</style>
