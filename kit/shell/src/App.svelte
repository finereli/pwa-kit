<script lang="ts">
  // Shell template: login gate, top bar, one scrolling body, drawer. Replace
  // the views; keep the structure. See reference/shell.md.
  import TopBar from '$shared/ui/TopBar.svelte'
  import Drawer from '$shared/ui/Drawer.svelte'
  import Login from '$shared/ui/Login.svelte'
  import ResetButton from '$shared/ui/ResetButton.svelte'
  import { auth } from './lib/auth.svelte'
  import { router } from './lib/router.svelte'

  router.start()
  auth.init()

  let menuOpen = $state(false)
  // Closing the drawer on navigation matters for the back button too, not just
  // for taps inside it.
  router.onChange(() => (menuOpen = false))

  const view = $derived(router.route.view)
  const entries = $derived([
    { label: 'Home', hash: '/', current: view === 'home' },
    { label: 'About', hash: '/about', current: view === 'about' },
  ])
  const title = $derived(view === 'about' ? 'About' : 'Home')
</script>

{#if !auth.signedIn}
  <Login {auth} title="My App" />
{/if}

<div class="shell">
  <TopBar leading="menu" {title} onleading={() => (menuOpen = true)} />

  <div class="body">
    {#if view === 'about'}
      <p>About</p>
    {:else}
      <p>Home</p>
    {/if}
  </div>
</div>

<Drawer open={menuOpen} onclose={() => (menuOpen = false)} {entries}>
  {#snippet brand()}
    <strong>My App</strong>
  {/snippet}
  {#snippet footer()}
    {#if auth.signedIn}
      <div class="user">{auth.user?.name}</div>
      <button class="auth-btn" onclick={() => auth.signOut()}>Sign out</button>
    {/if}
    <!-- The reload icon is the always-there escape hatch (forget the cached
         app, load it fresh); it lights up when a new version is waiting. -->
    <p class="build">
      <span>Version {__BUILD__}</span>
      <ResetButton tabindex={menuOpen ? 0 : -1} />
    </p>
  {/snippet}
</Drawer>

<style>
  .shell { display: flex; flex-direction: column; height: 100%; }
  /* The one scroller. A view that owns its own layout (a player, a chat)
     sets overflow: hidden here and scrolls inside itself instead. */
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }
  @media (min-width: 768px) {
    .shell { margin-inline-start: min(78vw, 300px); }
  }
  .user { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px; }
  .auth-btn { font-size: 0.8rem; color: var(--accent); padding: 6px 0; }
  .build { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; color: var(--text-secondary); margin-top: 8px; }
  .build span { opacity: 0.6; }
</style>
