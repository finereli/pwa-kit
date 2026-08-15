import { Router } from '$shared/lib/router.svelte'
type Route = { view: 'home' } | { view: 'about' }
export const router = new Router<Route>({ home: '/', parse(p) { return p === '/about' ? { view: 'about' } : { view: 'home' } } })
