<script lang="ts">
  import type { SentenceData } from '../lib/types'

  let { data = $bindable() }: { data: SentenceData } = $props()
  const toList = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean)
</script>

<div class="stack">
  <label class="field">영어 문장
    <textarea class="input" rows="3" bind:value={data.en}></textarea>
  </label>
  <label class="field">해석
    <textarea class="input" rows="2" bind:value={data.ko}></textarea>
  </label>
  <label class="field">핵심 표현 (쉼표로 구분)
    <input class="input" value={data.keyPhrases.join(', ')} onchange={(e) => (data.keyPhrases = toList(e.currentTarget.value))} />
  </label>
  <label class="field">출처 (선택)
    <input class="input" placeholder="예: TPO 54 Reading" bind:value={data.source} />
  </label>
</div>
