<script lang="ts">
  import { auth } from './lib/auth.svelte'
  import { route, match } from './lib/router.svelte'
  import Toasts from './components/Toasts.svelte'
  import Mascot from './components/Mascot.svelte'
  import Login from './routes/Login.svelte'
  import Home from './routes/Home.svelte'
  import DeckPage from './routes/Deck.svelte'
  import AddWords from './routes/AddWords.svelte'
  import EditNote from './routes/EditNote.svelte'
  import Study from './routes/Study.svelte'
  import Me from './routes/Me.svelte'

  const page = $derived.by(() => {
    const p = route.path
    let m
    if ((m = match('/deck/:id/add', p))) return { name: 'add', id: m.id }
    if ((m = match('/deck/:id/study', p))) return { name: 'study', id: m.id }
    if ((m = match('/deck/:id', p))) return { name: 'deck', id: m.id }
    if ((m = match('/note/:id', p))) return { name: 'note', id: m.id }
    if (match('/me', p)) return { name: 'me', id: '' }
    return { name: 'home', id: '' }
  })
</script>

{#if auth.loading}
  <div class="center"><Mascot size={72} /></div>
{:else if !auth.session}
  <Login />
{:else}
  <main>
    {#key page.name + page.id}
      {#if page.name === 'home'}<Home />
      {:else if page.name === 'deck'}<DeckPage id={page.id} />
      {:else if page.name === 'add'}<AddWords deckId={page.id} />
      {:else if page.name === 'study'}<Study deckId={page.id} />
      {:else if page.name === 'note'}<EditNote id={page.id} />
      {:else if page.name === 'me'}<Me />
      {/if}
    {/key}
  </main>
{/if}

<Toasts />

<style>
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 16px calc(32px + env(safe-area-inset-bottom));
  }
  .center { min-height: 100dvh; display: grid; place-items: center; }
</style>
