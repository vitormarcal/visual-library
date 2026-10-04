import { libraryDestination, libraryDestinationUrl, parseLibraryDestination, type LibraryDestination } from '../utils/library-navigation'

export type LibraryPosition = { scrollTop: number; focusId: string | null }
type Snapshot = LibraryPosition & { key: string; index: number; url: string }
type NavigationEntry = Snapshot & {
  version: 1
  library: Snapshot | null
  explore: Snapshot | null
  parent: Snapshot | null
}

export const useLibraryNavigation = () => {
  const initialUrl = useRequestURL()
  const initialState = import.meta.client ? useNuxtApp().$libraryHistoryState : null
  const router = useRouter()
  const destination = shallowRef(parseLibraryDestination(initialUrl))
  const entry = shallowRef<NavigationEntry | null>(null)
  const mode = ref<'initial' | 'push' | 'pop' | 'replace'>('initial')
  const snapshots = new Map<string, NavigationEntry>()
  let previousScrollRestoration: ScrollRestoration
  let scrollTimer: ReturnType<typeof setTimeout> | undefined
  let closing = false
  let pendingRefinement: { key: string; destination: LibraryDestination } | null = null
  let removeRouterHook: (() => void) | undefined

  const locationUrl = () => `${location.pathname}${location.search}${location.hash}`
  const snapshot = (value: NavigationEntry): Snapshot => ({ key: value.key, index: value.index, url: value.url, scrollTop: value.scrollTop, focusId: value.focusId })
  const readEntry = (state: unknown): NavigationEntry | null => {
    const value = (state as { visualLibrary?: NavigationEntry } | null)?.visualLibrary
    return value?.version === 1 && typeof value.key === 'string' && Number.isInteger(value.index)
      && typeof value.url === 'string' && typeof value.scrollTop === 'number' ? value : null
  }
  const position = (): LibraryPosition => ({
    scrollTop: window.scrollY,
    focusId: (document.activeElement as HTMLElement | null)?.dataset.exploreTagId
      ?? (document.activeElement as HTMLElement | null)?.dataset.lightboxOpenId ?? null,
  })
  const write = (value: NavigationEntry, push = false) => {
    snapshots.set(value.key, value)
    const state = { ...history.state, visualLibrary: JSON.parse(JSON.stringify(value)) }
    if (push) history.pushState(state, '', value.url)
    else history.replaceState(state, '', value.url)
    entry.value = value
  }
  const remember = (focusId?: string) => {
    if (!entry.value) return
    const value = { ...entry.value, ...position() }
    if (focusId) value.focusId = focusId
    if (!destination.value.imageId) {
      if (destination.value.screen === 'library') value.library = snapshot(value)
      if (destination.value.screen === 'explore') value.explore = snapshot(value)
    }
    write(value)
  }
  const makeEntry = (url: string, previous?: NavigationEntry | null): NavigationEntry => ({
    version: 1, key: crypto.randomUUID(), index: previous ? previous.index + 1 : 0,
    url, scrollTop: 0, focusId: null, library: previous?.library ?? null,
    explore: previous?.explore ?? null, parent: null,
  })
  const replace = (next: LibraryDestination) => {
    if (!entry.value || closing || next.problem) return
    const value = { ...entry.value, url: libraryDestinationUrl(next, entry.value.url) }
    if (!next.imageId) {
      if (next.screen === 'library') value.library = snapshot(value)
      if (next.screen === 'explore') value.explore = snapshot(value)
    }
    mode.value = 'replace'
    destination.value = next
    write(value)
  }
  const push = (next: LibraryDestination, focusId?: string) => {
    if (!entry.value || closing) return
    const url = libraryDestinationUrl(next, entry.value.url)
    if (url === entry.value.url && !destination.value.problem) return
    remember(focusId)
    const value = makeEntry(url, entry.value)
    if (next.imageId) value.parent = snapshot(entry.value!)
    mode.value = 'push'
    destination.value = next
    write(value, true)
  }
  const ensureViewerParent = () => {
    if (!entry.value || !destination.value.imageId || entry.value.parent || destination.value.problem) return
    const current = destination.value
    const base = { ...current, imageId: null }
    const value = { ...entry.value, url: libraryDestinationUrl(base, entry.value.url), parent: null }
    write(value)
    const overlay = makeEntry(libraryDestinationUrl(current, value.url), value)
    overlay.parent = snapshot(value)
    write(overlay, true)
  }
  const closeViewer = (refinement?: LibraryDestination) => {
    if (!entry.value || closing) return
    const parent = entry.value.parent
    if (!parent) { replace({ ...(refinement ?? destination.value), imageId: null }); return }
    if (refinement) pendingRefinement = { key: parent.key, destination: { ...refinement, imageId: null } }
    closing = true
    history.back()
  }
  const savedDestination = (screen: 'library' | 'explore') => {
    const saved = entry.value?.[screen]
    return saved ? { ...parseLibraryDestination(new URL(saved.url, initialUrl)), imageId: null } : libraryDestination(screen)
  }
  const returnToExplore = () => {
    if (!entry.value || closing) return
    const origin = entry.value.explore
    if (origin && origin.index < entry.value.index) {
      remember()
      closing = true
      history.go(origin.index - entry.value!.index)
    } else push(libraryDestination('explore'))
  }
  const onPop = (event: PopStateEvent) => {
    closing = false
    // location already belongs to the destination. Do not replace it with outgoing data.
    if (entry.value) snapshots.set(entry.value.key, { ...entry.value, ...position() })
    const stored = readEntry(event.state)
    let value = stored ? snapshots.get(stored.key) ?? stored : makeEntry(locationUrl())
    value = { ...value, url: locationUrl() }
    let next = parseLibraryDestination(new URL(value.url, initialUrl))
    if (pendingRefinement?.key === value.key) {
      next = pendingRefinement.destination
      value.url = libraryDestinationUrl(next, value.url)
    }
    pendingRefinement = null
    mode.value = 'pop'
    destination.value = next
    write(value)
  }
  const rememberSoon = () => {
    if (scrollTimer) clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => { if (!closing) remember() }, 100)
  }
  const rememberOnExit = () => { if (!closing) remember() }
  const start = () => {
    previousScrollRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const stored = readEntry(history.state) ?? readEntry(initialState)
    write(stored ? { ...stored, url: locationUrl() } : makeEntry(locationUrl()))
    // The Nuxt root router also replaces state asynchronously after popstate.
    removeRouterHook = router.afterEach(() => {
      // A viewer tag may refine its parent during the same pop. Preserve that
      // destination too, rather than the stale URL passed to Nuxt's listener.
      if (entry.value) write(entry.value)
    })
    window.addEventListener('popstate', onPop)
    window.addEventListener('scroll', rememberSoon, { passive: true })
    window.addEventListener('focusin', rememberSoon)
    window.addEventListener('pagehide', rememberOnExit)
  }
  const stop = () => {
    removeRouterHook?.()
    if (scrollTimer) clearTimeout(scrollTimer)
    window.removeEventListener('popstate', onPop)
    window.removeEventListener('scroll', rememberSoon)
    window.removeEventListener('focusin', rememberSoon)
    window.removeEventListener('pagehide', rememberOnExit)
    history.scrollRestoration = previousScrollRestoration
  }
  return { destination, entry, mode, start, stop, push, replace, remember, ensureViewerParent, closeViewer, savedDestination, returnToExplore }
}
