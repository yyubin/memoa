<script lang="ts">
  import Sheet from './Sheet.svelte'
  import JobArt from './JobArt.svelte'
  import { JOBS, type JobId } from '../lib/jobs'

  let {
    open = $bindable(false),
    current,
    required = false,
    onpick,
  }: { open?: boolean; current?: string; required?: boolean; onpick: (job: JobId) => Promise<void> } = $props()

  let busy = $state<JobId | null>(null)

  async function pick(id: JobId) {
    if (busy) return
    busy = id
    try {
      await onpick(id)
      open = false
    } catch {
      /* 오류 안내는 부모가 토스트로 처리 — 시트는 열어둔다 */
    } finally {
      busy = null
    }
  }
</script>

<Sheet bind:open title={required ? '직업을 골라주세요' : '직업 변경'} dismissable={!required}>
  <p class="lead muted">
    {required ? '단어를 외울수록 캐릭터가 레벨업해요.' : '레벨과 경험치는 그대로, 모습만 바뀌어요.'}
  </p>
  <div class="grid">
    {#each JOBS as job (job.id)}
      <button class="job" class:on={current === job.id} type="button" disabled={!!busy} aria-pressed={current === job.id} onclick={() => pick(job.id)}>
        <span class="pic"><JobArt job={job.id} size="100%" /></span>
        <span class="name">{job.name}</span>
        <span class="ko">{job.ko}{busy === job.id ? ' …' : ''}</span>
        <span class="motto muted">{job.motto}</span>
      </button>
    {/each}
  </div>
</Sheet>

<style>
  .lead { margin: -6px 0 14px; font-size: 14px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .job {
    display: grid; justify-items: center; gap: 2px; text-align: center;
    padding: 10px 10px 14px; min-width: 0;
    border: 2.5px solid var(--line); border-radius: 22px; background: var(--card); cursor: pointer;
    transition: transform .08s ease;
  }
  .job:active { transform: scale(.97); }
  .job.on { box-shadow: 0 0 0 3px var(--bg), 0 0 0 6px var(--ink); }
  .job:disabled { cursor: default; }
  .pic { width: 100%; max-width: 150px; }
  .name { font-family: var(--font-title); font-size: 19px; line-height: 1.1; margin-top: 4px; }
  .ko { font-weight: 800; font-size: 13px; }
  .motto { font-size: 12px; line-height: 1.4; word-break: keep-all; }
</style>
