<script lang="ts">
  /** 내 직업 캐릭터 (마스코트 대신). 직업을 모르면 팔라딘 */
  import JobArt from './JobArt.svelte'
  import { myJob } from '../lib/profile.svelte'

  let { size = 96, sparkles = false }: { size?: number | string; sparkles?: boolean } = $props()
  const job = $derived(myJob()?.id ?? 'paladin')
</script>

<JobArt {job} {size} {sparkles} />
