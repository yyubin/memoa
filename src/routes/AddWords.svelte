<script lang="ts">
  import { onMount } from 'svelte'
  import { enrichWords, extractPhoto, saveNote, findNoteByWord, getDeck, aiUsageToday, type PhotoField } from '../lib/api'
  import { prepareImage } from '../lib/image'
  import { toast, errorText } from '../lib/toast.svelte'
  import { go } from '../lib/router.svelte'
  import type { Deck, SentenceData, VocabData } from '../lib/types'
  import TopBar from '../components/TopBar.svelte'
  import Mascot from '../components/Mascot.svelte'
  import VocabEditor from '../components/VocabEditor.svelte'
  import SentenceEditor from '../components/SentenceEditor.svelte'

  let { deckId }: { deckId: string } = $props()

  type Draft = { key: string; data: VocabData; dup: boolean; open: boolean; photo?: PhotoField[] }

  let deck = $state<Deck | null>(null)
  let tab = $state<'ai' | 'photo' | 'manual' | 'sentence'>('ai')
  let photoHint = $state('')
  let photoPreview = $state<string | null>(null)
  let photoStatus = $state('')
  let input = $state('')
  let busy = $state(false)
  let drafts = $state<Draft[]>([])
  let failed = $state<Record<string, string>>({})
  let usage = $state<{ used: number; limit: number } | null>(null)

  let manual = $state<VocabData>(emptyVocab())
  let sentence = $state<SentenceData>({ en: '', ko: '', keyPhrases: [], source: '' })

  function emptyVocab(): VocabData {
    return { word: '', ipa: '', senses: [{ pos: 'v.', ko: '', en: '', synonyms: [], antonyms: [], distractors: [], examples: [] }], collocations: [] }
  }

  const MAX = 10
  const words = $derived(
    [...new Set(input.split(/[\n,]/).map((w) => w.trim().toLowerCase()).filter((w) => /^[a-z][a-z' -]*$/.test(w)))].slice(0, MAX),
  )

  async function generate() {
    if (!words.length) return
    busy = true
    failed = {}
    try {
      const res = await enrichWords(words)
      usage = res.usage
      const next: Draft[] = []
      for (const w of words) {
        const r = res.results[w]
        if (!r) continue
        if (!r.is_word) { failed[w] = '사전에 없는 단어 같아요'; continue }
        const { is_word: _ignored, ...data } = r
        const dup = !!(await findNoteByWord(deckId, data.word))
        next.push({ key: w, data: { ...data, ai: true }, dup, open: false })
      }
      Object.assign(failed, res.errors)
      drafts = [...drafts.filter((d) => !next.some((n) => n.key === d.key)), ...next]
      input = ''
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      busy = false
    }
  }

  async function saveAll() {
    busy = true
    let ok = 0
    try {
      for (const d of drafts.filter((d) => !d.dup)) {
        await saveNote({ deck_id: deckId, type: 'vocab', data: $state.snapshot(d.data) as VocabData })
        drafts = drafts.filter((x) => x.key !== d.key)
        ok++
      }
      toast(`${ok}개 저장했어요! 🐟`)
      drafts = []
    } catch (e) {
      toast(`${ok}개 저장 후 실패: ${errorText(e)}`, 'error')
    } finally {
      busy = false
    }
  }

  /** 사진 여러 장을 차례로 처리해서 미리보기에 추가 */
  async function onPhotos(e: Event & { currentTarget: HTMLInputElement }) {
    const files = [...(e.currentTarget.files ?? [])]
    e.currentTarget.value = ''
    if (!files.length) return
    busy = true
    let added = 0
    try {
      for (const [i, file] of files.entries()) {
        photoStatus = files.length > 1 ? `사진 ${i + 1}/${files.length} 읽는 중…` : '사진 읽는 중…'
        const img = await prepareImage(file)
        photoPreview = img.preview
        try {
          const res = await extractPhoto(img, photoHint.trim())
          usage = res.usage
          if (res.kind === 'other' || res.entries.length === 0) {
            toast(`사진 ${i + 1}: 단어를 찾지 못했어요 😿`, 'error')
            continue
          }
          for (const entry of res.entries) {
            const { is_word: _w, from_photo, ...data } = entry
            if (drafts.some((d) => d.key === data.word)) continue
            const dup = !!(await findNoteByWord(deckId, data.word))
            drafts.push({ key: data.word, data: { ...data, ai: true }, dup, open: false, photo: from_photo })
            added++
          }
          if (res.truncated > 0) toast(`AI 한도 때문에 ${res.truncated}개는 빠졌어요`, 'error')
        } catch (err) {
          toast(`사진 ${i + 1}: ${errorText(err)}`, 'error')
        }
      }
      if (added) toast(`사진에서 ${added}개 찾았어요! 확인 후 저장하세요 📷`)
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      busy = false
      photoStatus = ''
    }
  }

  const PHOTO_LABEL: Record<PhotoField, string> = { ko: '뜻', en: '영영', synonyms: '유의어', antonyms: '반의어', examples: '예문' }

  async function saveManual() {
    if (!manual.word.trim()) return toast('단어를 입력해 주세요', 'error')
    busy = true
    try {
      await saveNote({ deck_id: deckId, type: 'vocab', data: $state.snapshot(manual) as VocabData })
      toast(`"${manual.word}" 저장!`)
      manual = emptyVocab()
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      busy = false
    }
  }

  async function saveSentence() {
    if (!sentence.en.trim() || !sentence.ko.trim()) return toast('문장과 해석을 모두 입력해 주세요', 'error')
    busy = true
    try {
      await saveNote({ deck_id: deckId, type: 'sentence', data: $state.snapshot(sentence) as SentenceData })
      toast('문장 저장!')
      sentence = { en: '', ko: '', keyPhrases: [], source: sentence.source }
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      busy = false
    }
  }

  onMount(async () => {
    try {
      deck = await getDeck(deckId)
      usage = { used: await aiUsageToday(), limit: 0 }
    } catch { /* 무시 */ }
  })
</script>

<TopBar back={`/deck/${deckId}`} title={deck ? `${deck.emoji} 단어 추가` : '단어 추가'} />

<div class="tabs">
  <button class:on={tab === 'ai'} onclick={() => (tab = 'ai')}>✨ AI 자동</button>
  <button class:on={tab === 'photo'} onclick={() => (tab = 'photo')}>📷 사진</button>
  <button class:on={tab === 'manual'} onclick={() => (tab = 'manual')}>✍️ 직접 입력</button>
  <button class:on={tab === 'sentence'} onclick={() => (tab = 'sentence')}>💬 문장</button>
</div>

{#if tab === 'ai'}
  <section class="box panel stack">
    <div class="row hint">
      <Mascot size={44} mood={busy ? 'wow' : 'happy'} />
      <p>단어만 적어주면 뜻·동의어·반의어·예문은 내가 채워줄게! <span class="muted">(한 줄에 하나, 최대 {MAX}개)</span></p>
    </div>
    <textarea class="input" rows="5" placeholder={'mitigate\nsubstantial\nhypothesis'} bind:value={input} disabled={busy}></textarea>
    <div class="row">
      {#if usage}<span class="muted small">오늘 AI 사용 {usage.used}{usage.limit ? ` / ${usage.limit}` : ''}</span>{/if}
      <span class="spacer"></span>
      <button class="btn primary" onclick={generate} disabled={busy || !words.length}>
        {busy ? '모아가 열심히 찾는 중… 🐾' : `${words.length || ''}개 채우기`}
      </button>
    </div>
  </section>

{:else if tab === 'photo'}
  <section class="box panel stack">
    <div class="row hint">
      <Mascot size={44} mood={busy ? 'wow' : 'happy'} />
      <p>단어장, 교재, 지문 사진을 찍어줘! 사진에 적힌 뜻·유의어·반의어는 그대로 쓰고, 빠진 건 내가 채울게. <span class="muted">(여러 장 가능)</span></p>
    </div>
    <input class="input" placeholder="메모 (선택) 예: 밑줄 친 단어만 / 3번 단원만" maxlength="200" bind:value={photoHint} disabled={busy} />
    <div class="photo-btns">
      <label class="btn primary" class:disabled={busy}>
        📷 촬영하기
        <input type="file" accept="image/*" capture="environment" onchange={onPhotos} disabled={busy} hidden />
      </label>
      <label class="btn butter" class:disabled={busy}>
        🖼️ 앨범에서 (여러 장)
        <input type="file" accept="image/*" multiple onchange={onPhotos} disabled={busy} hidden />
      </label>
    </div>
    {#if busy && photoStatus}
      <div class="row status"><span class="wiggle">🐾</span> {photoStatus} <span class="muted small">(단어가 많으면 1분쯤 걸려요)</span></div>
    {/if}
    {#if photoPreview}<img class="preview" src={photoPreview} alt="올린 사진 미리보기" />{/if}
    {#if usage}<span class="muted small">오늘 AI 사용 {usage.used}{usage.limit ? ` / ${usage.limit}` : ''}</span>{/if}
  </section>
{/if}

{#if tab === 'ai' || tab === 'photo'}
  {#if Object.keys(failed).length}
    <div class="box fail">
      {#each Object.entries(failed) as [w, msg]}<div>😿 <b>{w}</b>: {msg}</div>{/each}
    </div>
  {/if}

  {#if drafts.length}
    <div class="row head">
      <h3>미리보기 {drafts.length}개</h3>
      <span class="muted small">눌러서 고칠 수 있어요</span>
      <span class="spacer"></span>
      <button class="btn mint" onclick={saveAll} disabled={busy || drafts.every((d) => d.dup)}>모두 저장</button>
    </div>
    <div class="drafts">
      {#each drafts as d, i (d.key)}
        <div class="box draft pop" class:dup={d.dup}>
          <div class="row">
            <button class="summary" onclick={() => (d.open = !d.open)}>
              <span class="title w">{d.data.word}</span>
              <span class="muted ipa">{d.data.ipa}</span>
              {#if d.dup}<span class="chip warn">이미 있음</span>{/if}
              {#if d.photo?.length}<span class="chip photo">📷 {d.photo.map((f) => PHOTO_LABEL[f]).join('·')}</span>{/if}
            </button>
            <button class="btn ghost small" onclick={() => drafts.splice(i, 1)} aria-label="빼기">✕</button>
          </div>
          {#if d.open}
            <VocabEditor bind:data={d.data} />
          {:else}
            {#each d.data.senses as s}
              <div class="sline">
                <span class="chip">{s.pos}</span> <b>{s.ko}</b>
                <div class="muted small">{s.en}</div>
                {#if s.synonyms.length}<div class="small">🔁 {s.synonyms.join(', ')}</div>{/if}
                {#if s.antonyms.length}<div class="small">🙃 {s.antonyms.join(', ')}</div>{/if}
              </div>
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
{/if}

{#if tab === 'manual'}
  <section class="box panel stack">
    <VocabEditor bind:data={manual} />
    <button class="btn mint block" onclick={saveManual} disabled={busy}>저장</button>
  </section>
{:else if tab === 'sentence'}
  <section class="box panel stack">
    <SentenceEditor bind:data={sentence} />
    <button class="btn mint block" onclick={saveSentence} disabled={busy}>저장</button>
  </section>
{/if}

{#if !busy && tab === 'ai' && drafts.length === 0}
  <p class="center"><button class="btn ghost small" onclick={() => go(`/deck/${deckId}`)}>단어장으로 돌아가기</button></p>
{/if}

<style>
  .tabs { display: grid; grid-template-columns: repeat(4, 1fr); border: 2.5px solid var(--line); border-radius: 999px; overflow: hidden; margin-bottom: 16px; background: var(--card); }
  .tabs button { border: 0; background: transparent; padding: 9px 4px; font-family: var(--font-title); font-size: 16px; cursor: pointer; }
  .tabs button.on { background: var(--butter); color: #3d3214; }
  .panel { padding: 16px; margin-bottom: 18px; }
  .hint { align-items: center; }
  .hint p { margin: 0; font-size: 15px; }
  .small { font-size: 13px; }
  .fail { padding: 12px 16px; background: var(--berry-soft); margin-bottom: 16px; font-size: 14px; }
  .head { margin: 8px 0 12px; flex-wrap: wrap; }
  .head h3 { font-size: 20px; }
  .drafts { display: grid; gap: 12px; }
  .draft { padding: 14px; display: grid; gap: 8px; }
  .draft.dup { opacity: .6; }
  .summary { flex: 1; display: flex; gap: 8px; align-items: baseline; background: none; border: 0; padding: 0; text-align: left; cursor: pointer; }
  .w { font-size: 22px; }
  .ipa { font-size: 14px; }
  .warn { background: var(--berry-soft); }
  .sline { padding-left: 4px; }
  .center { text-align: center; }
  .photo-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 480px) { .photo-btns { grid-template-columns: 1fr; } }
  .photo-btns .disabled { opacity: .5; pointer-events: none; }
  .status { font-size: 15px; }
  .preview { max-height: 220px; max-width: 100%; justify-self: center; border: 2.5px solid var(--line); border-radius: 14px; }
  .photo { background: var(--sky-soft); }
</style>
