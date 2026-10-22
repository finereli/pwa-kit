<!-- pwa-kit: shell/src/App.svelte v6 -->
<script lang="ts">
  // Shell template: login gate, top bar, one scrolling body, drawer. Replace
  // the views; keep the structure. See reference/shell.md.
  import TopBar from '$shared/ui/TopBar.svelte'
  import Drawer from '$shared/ui/Drawer.svelte'
  import Login from '$shared/ui/Login.svelte'
  import ResetButton from '$shared/ui/ResetButton.svelte'
  import AccountMenu from '$shared/ui/AccountMenu.svelte'
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
    <!-- One row, as tall as the brand band: who you are on the start side,
         icon buttons on the end. The reload icon is the always-there escape
         hatch (forget the cached app, load it fresh); it lights up when a new
         version is waiting. Add a light/dark toggle and a settings gear here
         when the app has them. -->
    <div class="footer-row">
      {#if auth.signedIn}
        <AccountMenu name={auth.user?.name || auth.user?.email || ''} picture={auth.user?.picture || null} tabindex={menuOpen ? 0 : -1}>
          {#snippet menu(close)}
            <button role="menuitem" onclick={() => { close(); auth.signOut() }}>Sign out</button>
            <p class="build">Version {__BUILD__}</p>
          {/snippet}
        </AccountMenu>
      {:else}
        <span class="build grow">Version {__BUILD__}</span>
      {/if}
      <ResetButton tabindex={menuOpen ? 0 : -1} />
    </div>
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
  .footer-row { display: flex; align-items: center; gap: 4px; }
  .build { padding: 6px 10px 4px; font-size: 0.7rem; color: var(--text-secondary); opacity: 0.7; }
  .grow { flex: 1; padding: 0; }
</style>
