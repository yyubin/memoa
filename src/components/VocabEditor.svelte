<script lang="ts">
  import { POS_LIST, type Sense, type VocabData } from '../lib/types'
  import { speak } from '../lib/quiz'

  let { data = $bindable(), compact = false }: { data: VocabData; compact?: boolean } = $props()

  const toList = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean)

  function newSense(): Sense {
    return { pos: 'n.', ko: '', en: '', synonyms: [], antonyms: [], distractors: [], examples: [] }
  }
</script>

<div class="ed stack">
  <div class="row wordrow">
    <input class="input word title" placeholder="단어" bind:value={data.word} />
    <input class="input ipa" placeholder="/발음기호/" bind:value={data.ipa} />
    <button type="button" class="btn small" onclick={() => speak(data.word)} aria-label="발음 듣기">🔊</button>
  </div>

  {#each data.senses as sense, i}
    <div class="sense">
      <div class="row">
        <span class="num title">{i + 1}</span>
        <select class="input pos" bind:value={sense.pos}>
          {#each POS_LIST as p}<option value={p}>{p}</option>{/each}
        </select>
        <input class="input" placeholder="한글 뜻 (예: 완화하다, 줄이다)" bind:value={sense.ko} />
        {#if data.senses.length > 1}
          <button type="button" class="btn ghost small" onclick={() => data.senses.splice(i, 1)} aria-label="뜻 삭제">✕</button>
        {/if}
      </div>
      <input class="input" placeholder="영영 뜻 (English definition)" bind:value={sense.en} />

      <div class="grid2">
        <label class="field">🔁 동의어
          <input class="input" value={sense.synonyms.join(', ')} onchange={(e) => (sense.synonyms = toList(e.currentTarget.value))} placeholder="쉼표로 구분" />
        </label>
        <label class="field">🙃 반의어
          <input class="input" value={sense.antonyms.join(', ')} onchange={(e) => (sense.antonyms = toList(e.currentTarget.value))} placeholder="쉼표로 구분" />
        </label>
      </div>
      {#if !compact}
        <label class="field">🎭 오답 보기 (동의어 문제용, 비슷하지만 틀린 단어)
          <input class="input" value={sense.distractors.join(', ')} onchange={(e) => (sense.distractors = toList(e.currentTarget.value))} />
        </label>
      {/if}

      {#each sense.examples as ex, j}
        <div class="ex">
          <textarea class="input" rows="2" placeholder="예문 (영어)" bind:value={ex.en}></textarea>
          <input class="input" placeholder="해석" bind:value={ex.ko} />
          <div class="row">
            <input class="input" placeholder="예문 속 단어 형태 (예: mitigated)" bind:value={ex.target} />
            <button type="button" class="btn ghost small" onclick={() => sense.examples.splice(j, 1)} aria-label="예문 삭제">✕</button>
          </div>
        </div>
      {/each}
      <button type="button" class="btn small add" onclick={() => sense.examples.push({ en: '', ko: '', target: '' })}>+ 예문</button>
    </div>
  {/each}

  <button type="button" class="btn small add" onclick={() => data.senses.push(newSense())}>+ 다른 뜻 추가</button>

  {#if !compact}
    <label class="field">🧷 자주 쓰는 표현
      <input class="input" value={data.collocations.join(', ')} onchange={(e) => (data.collocations = toList(e.currentTarget.value))} />
    </label>
  {/if}
</div>

<style>
  .ed { gap: 12px; }
  .wordrow { flex-wrap: wrap; }
  .word { flex: 2; min-width: 140px; font-size: 20px; }
  .ipa { flex: 1; min-width: 110px; }
  .sense { display: grid; gap: 8px; padding: 12px; border: 2px dashed var(--ink-soft); border-radius: 14px; }
  .num { width: 28px; height: 28px; display: grid; place-items: center; background: var(--butter); border: 2px solid var(--line); border-radius: 50%; flex: none; }
  .pos { width: 84px; flex: none; padding-left: 8px; padding-right: 4px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 520px) { .grid2 { grid-template-columns: 1fr; } }
  .ex { display: grid; gap: 6px; padding: 8px; background: var(--sky-soft); border-radius: 12px; }
  .ex textarea { min-height: 56px; }
  .add { justify-self: start; box-shadow: none; }
</style>
