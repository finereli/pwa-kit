<!-- pwa-kit: push/ui/PushBanner.svelte v6 -->
<script lang="ts">
  // The notifications ask: the same card as InstallBanner (kit install/),
  // dropping in from the top. A tap on it is the user gesture the permission
  // prompt needs, so the browser's own dialog follows right away; the card
  // says first why the app would notify, which the bare dialog never does.
  //
  // When it shows (reference/behavior.md, Asks): `when` is the host's
  // engagement signal (a first note written, a first session finished) and
  // its "no other ask is on screen" - pass `when={engaged && !installShowing}`.
  // On top of that it shows only while push is 'off' here: not when it's on,
  // denied (only browser settings can undo that), unsupported, or an iPhone
  // outside the home screen (push needs the install there; InstallBanner
  // asks first). Nor in a browser tab once the app is installed
  // (install/lib/installed.ts): the order is try, install, use, then
  // notifications, so it asks the first time the installed app opens.
  // Dismissed, it comes back once after `again` ms, then never: Settings
  // keeps the toggle.
  //
  // Needs the icons kit (notifications, close), makePush (lib/push.ts) and
  // install's lib/installed.ts.
  // Seams: the strings, `top`, `again`, the storage key (from makePush's).
  import { fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import Icon from './Icon.svelte'
  import type { makePush, PushState } from '../lib/push'
  import { tabWithAppInstalled } from '../lib/installed'

  let {
    push,
    storageKey,
    when = false,
    text = 'Turn on notifications?',
    closeLabel = 'Not now',
    again = 7 * 86400_000,
    top = 'calc(var(--safe-top) + var(--topbar-h) + 10px)',
    ondone,
    visible = $bindable(false),
  }: {
    push: ReturnType<typeof makePush>
    storageKey: string // e.g. 'myapp.pushask.v1'
    when?: boolean; text?: string; closeLabel?: string; again?: number; top?: string
    ondone?: (state: PushState) => void
    visible?: boolean
  } = $props()

  let current = $state<PushState | null>(null)
  let busy = $state(false)

  // { n: times dismissed, at: when last }
  function asked(): { n: number; at: number } {
    try { return JSON.parse(localStorage.getItem(storageKey) || '') } catch { return { n: 0, at: 0 } }
  }
  function remember(n: number) {
    try { localStorage.setItem(storageKey, JSON.stringify({ n, at: Date.now() })) } catch {}
  }
  const due = () => {
    const a = asked()
    return a.n === 0 || (a.n === 1 && Date.now() - a.at > again)
  }

  $effect(() => {
    if (!when || tabWithAppInstalled()) { visible = false; return }
    push.pushState().then((s) => {
      current = s
      visible = when && s === 'off' && due()
    })
  })

  async function enable() {
    if (busy) return
    busy = true
    try {
      current = await push.enablePush()
    } catch {
      current = await push.pushState()
    } finally {
      busy = false
    }
    // Granted, or a "Block" in the browser's dialog: either way, don't ask again.
    if (current !== 'off') remember(2)
    else remember(asked().n + 1)
    visible = false
    ondone?.(current)
  }

  function dismiss() {
    remember(asked().n + 1)
    visible = false
    ondone?.(current ?? 'off')
  }
</script>

{#if visible}
  <div class="banner" role="alert" style:top in:fly={{ y: -90, duration: 450, easing: cubicOut }} out:fly={{ y: -50, duration: 200 }}>
    <button class="tip" onclick={enable} disabled={busy}>
      <span class="lead"><Icon name="notifications" size={20} /></span>
      <span class="text">{text}</span>
    </button>
    <button class="close" onclick={dismiss} aria-label={closeLabel} title={closeLabel}>
      <Icon name="close" size={18} />
    </button>
  </div>
{/if}

<style>
  /* The same card as InstallBanner. */
  .banner {
    --highlight: #ecc65a;
    position: fixed;
    inset-inline: 12px;
    margin-inline: auto;
    z-index: 30;
    display: flex;
    align-items: center;
    max-width: 380px;
    padding: 10px 12px 10px 14px;
    background: color-mix(in srgb, var(--accent-deep) 94%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: #fff;
    border-radius: 14px;
    border-bottom: 3px solid var(--highlight);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  }
  @media (min-width: 768px) {
    .banner { inset-inline-start: calc(min(78vw, 300px) + 12px); }
  }
  .tip {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    text-align: start;
    line-height: 1.35;
  }
  .tip .lead { flex: none; display: inline-flex; color: var(--highlight); }
  .tip .text { font-size: 0.86rem; font-weight: 500; }
  .close {
    flex: none;
    display: grid;
    place-items: center;
    color: #fff;
    opacity: 0.55;
    transition: opacity 0.15s;
  }
  .close:hover { opacity: 1; }
</style>
