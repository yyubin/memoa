<script lang="ts">
  import { supabase } from '../lib/supabase'
  import { toast, errorText } from '../lib/toast.svelte'
  import MyChar from '../components/MyChar.svelte'

  let mode = $state<'login' | 'signup'>('login')
  let email = $state('')
  let password = $state('')
  let nickname = $state('')
  let invite = $state('')
  let busy = $state(false)
  let sent = $state(false)

  function friendly(msg: string) {
    if (/invalid login/i.test(msg)) return '이메일 또는 비밀번호가 틀렸어요'
    if (/database error|INVALID_INVITE/i.test(msg)) return '초대 코드가 올바르지 않거나 이미 사용됐어요'
    if (/already registered/i.test(msg)) return '이미 가입된 이메일이에요'
    if (/password.*(6|short)/i.test(msg)) return '비밀번호는 6자 이상이어야 해요'
    if (/email not confirmed/i.test(msg)) return '메일함에서 인증 링크를 먼저 눌러주세요'
    return msg
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    busy = true
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nickname: nickname.trim(), invite_code: invite.trim().toUpperCase() },
            emailRedirectTo: location.origin,
          },
        })
        if (error) throw error
        if (!data.session) sent = true
      }
    } catch (err) {
      toast(friendly(errorText(err)), 'error')
    } finally {
      busy = false
    }
  }
</script>

<div class="wrap">
  <div class="hero">
    <MyChar size={150} sparkles />
    <h1>메모아</h1>
    <p class="muted">단어를 외우면 캐릭터가 레벨업 ✦</p>
  </div>

  {#if sent}
    <div class="box panel pop">
      <h3>📮 메일을 보냈어요!</h3>
      <p>메일함에서 인증 링크를 누르면 바로 시작할 수 있어요.</p>
      <button class="btn block" onclick={() => { sent = false; mode = 'login' }}>로그인으로</button>
    </div>
  {:else}
    <form class="box panel stack" onsubmit={submit}>
      <div class="tabs">
        <button type="button" class:on={mode === 'login'} onclick={() => (mode = 'login')}>로그인</button>
        <button type="button" class:on={mode === 'signup'} onclick={() => (mode = 'signup')}>가입하기</button>
      </div>

      <label class="field">이메일
        <input class="input" type="email" autocomplete="email" required bind:value={email} />
      </label>
      <label class="field">비밀번호
        <input class="input" type="password" autocomplete={mode === 'login' ? 'current-password' : 'new-password'} minlength="6" required bind:value={password} />
      </label>

      {#if mode === 'signup'}
        <label class="field">닉네임
          <input class="input" maxlength="20" placeholder="모아친구" bind:value={nickname} />
        </label>
        <label class="field">초대 코드
          <input class="input code" maxlength="12" placeholder="친구에게 받은 코드" bind:value={invite} />
          <small>처음 가입하는 관리자는 비워두세요</small>
        </label>
      {/if}

      <button class="btn primary block" disabled={busy}>
        {busy ? '잠깐만요…' : mode === 'login' ? '들어가기' : '가입하기'}
      </button>
    </form>
  {/if}
</div>

<style>
  .wrap { max-width: 400px; margin: 0 auto; padding: 48px 16px; display: grid; gap: 24px; }
  .hero { text-align: center; display: grid; justify-items: center; gap: 4px; }
  h1 { font-size: 44px; }
  .panel { padding: 22px; }
  .tabs { display: grid; grid-template-columns: 1fr 1fr; border: 2.5px solid var(--line); border-radius: 999px; overflow: hidden; }
  .tabs button { border: 0; background: transparent; padding: 8px; font-family: var(--font-title); font-size: 17px; cursor: pointer; }
  .tabs button.on { background: var(--ink); color: var(--bg); }
  .code { text-transform: uppercase; letter-spacing: 2px; }
  small { color: var(--ink-soft); font-size: 12px; }
</style>
