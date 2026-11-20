<script lang="ts">
  import { onMount } from 'svelte'
  import { getProfile, updateNickname, createInvite, listInvites, aiUsageToday } from '../lib/api'
  import { supabase } from '../lib/supabase'
  import { toast, errorText } from '../lib/toast.svelte'
  import type { Profile } from '../lib/types'
  import TopBar from '../components/TopBar.svelte'
  import Mascot from '../components/Mascot.svelte'

  let profile = $state<Profile | null>(null)
  let nickname = $state('')
  let invites = $state<{ code: string; used_at: string | null; expires_at: string | null }[]>([])
  let aiUsed = $state(0)

  onMount(async () => {
    try {
      profile = await getProfile()
      nickname = profile.nickname
      aiUsed = await aiUsageToday()
      if (profile.is_admin) invites = await listInvites()
    } catch (e) {
      toast(errorText(e), 'error')
    }
  })

  async function saveNick() {
    if (!nickname.trim()) return
    try {
      await updateNickname(nickname.trim())
      toast('닉네임을 바꿨어요')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  async function newInvite() {
    try {
      const code = await createInvite()
      invites = await listInvites()
      await navigator.clipboard?.writeText(code).catch(() => {})
      toast(`초대 코드 ${code} 복사했어요!`)
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  function status(i: { used_at: string | null; expires_at: string | null }) {
    if (i.used_at) return '사용됨'
    if (i.expires_at && new Date(i.expires_at) < new Date()) return '만료'
    return '사용 가능'
  }
</script>

<TopBar back="/" title="내 정보" />

<section class="box panel stack">
  <div class="row"><Mascot size={52} /><div class="title name">{profile?.nickname ?? ''}</div></div>
  <label class="field">닉네임
    <div class="row">
      <input class="input" maxlength="20" bind:value={nickname} />
      <button class="btn small" onclick={saveNick}>저장</button>
    </div>
  </label>
  <p class="muted small">오늘 AI 사용: {aiUsed}개</p>
</section>

{#if profile?.is_admin}
  <section class="box panel stack">
    <div class="row">
      <h3>💌 친구 초대</h3>
      <span class="spacer"></span>
      <button class="btn butter small" onclick={newInvite}>코드 만들기</button>
    </div>
    <p class="muted small">코드는 14일 동안, 한 번만 쓸 수 있어요.</p>
    <ul class="invites">
      {#each invites as i}
        <li class="row">
          <code>{i.code}</code>
          <span class="spacer"></span>
          <span class="chip" class:used={status(i) !== '사용 가능'}>{status(i)}</span>
        </li>
      {:else}
        <li class="muted small">아직 만든 코드가 없어요</li>
      {/each}
    </ul>
  </section>
{/if}

<button class="btn block" onclick={() => supabase.auth.signOut()}>로그아웃</button>

<style>
  .panel { padding: 18px; margin-bottom: 16px; }
  .name { font-size: 24px; }
  .small { font-size: 13px; margin: 0; }
  h3 { font-size: 20px; }
  .invites { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
  code { font-size: 18px; letter-spacing: 3px; font-weight: 700; }
  .chip.used { background: var(--card); opacity: .6; }
</style>
