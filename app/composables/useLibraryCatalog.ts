import type { ImageRecord } from '../types/image'
import type { LibraryDestination } from '../utils/library-navigation'

type Page = { images: ImageRecord[]; total: number; subjectTotal: number; nextCursor: string | null }
type Listing = { ids: string[]; total: number; subjectTotal: number; cursor: string | null; started: boolean; busy: boolean; error: boolean; generation: number }
const listing = (): Listing => reactive({ ids: [], total: 0, subjectTotal: 0, cursor: null, started: false, busy: false, error: false, generation: 0 })
export function useLibraryCatalog(destination: Ref<LibraryDestination>, known: Ref<ImageRecord[]>) {
  const api = useNuxtApp().$libraryApi
  const sessions = new Map<string, Listing>()
  const current = shallowRef<Listing>(listing())
  const enabled = computed(() => ['library', 'subject'].includes(destination.value.screen) && destination.value.searchMode === 'text' && !destination.value.problem)
  const query = computed(() => ({ hidden: destination.value.hidden ? '1' : '0', q: destination.value.query,
    tag: [...(destination.value.subjectId ? [destination.value.subjectId] : []), ...destination.value.tagIds] }))
  const key = computed(() => JSON.stringify([enabled.value, query.value]))
  const merge = (incoming: ImageRecord[]) => {
    const updates = new Map(incoming.map(image => [image.id, image]))
    known.value = [...known.value.filter(image => !updates.has(image.id)), ...incoming]
  }
  const byId = computed(() => new Map(known.value.map(image => [image.id, image])))
  const images = computed(() => current.value.ids.map(id => byId.value.get(id)).filter((image): image is ImageRecord => Boolean(image)))
  let disposed = false, revision = 0
  async function load(state = current.value, next = false) {
    if (!enabled.value || disposed || state.busy || (next && !state.cursor)) return
    const requestQuery = { ...query.value, ...(next ? { cursor: state.cursor! } : {}) }, generation = state.generation, ownRevision = revision
    state.busy = true; state.error = false
    try {
      const page = await api<Page>('/api/library/images', { query: requestQuery })
      if (disposed || ownRevision !== revision || generation !== state.generation) return
      merge(page.images)
      state.ids = next ? [...new Set([...state.ids, ...page.images.map(image => image.id)])] : page.images.map(image => image.id)
      state.total = page.total; state.subjectTotal = page.subjectTotal; state.cursor = page.nextCursor; state.started = true
    } catch { if (!disposed && generation === state.generation) state.error = true }
    finally { if (generation === state.generation) state.busy = false }
  }
  function activate() {
    if (!enabled.value) return
    let state = sessions.get(key.value)
    if (!state) { state = listing(); if (sessions.size >= 20) sessions.delete(sessions.keys().next().value!); sessions.set(key.value, state) }
    current.value = state
    if (!state.started && !state.busy) void load(state)
  }
  let debounce: ReturnType<typeof setTimeout> | undefined
  watch(key, (value, previous) => {
    if (!import.meta.client) return
    if (debounce) clearTimeout(debounce)
    // Switch state immediately, so results for an old query never flash under new criteria.
    if (!enabled.value) return
    let state = sessions.get(value)
    if (!state) { state = listing(); if (sessions.size >= 20) sessions.delete(sessions.keys().next().value!); sessions.set(value, state) }
    current.value = state
    if (!state.started) debounce = setTimeout(activate, previous ? 200 : 0)
  }, { flush: 'sync' })
  onBeforeUnmount(() => { disposed = true; if (debounce) clearTimeout(debounce); for (const state of sessions.values()) state.generation++; sessions.clear(); known.value = [] })
  const refresh = async () => {
    revision++
    for (const state of sessions.values()) { state.generation++; state.started = false; state.busy = false }
    if (enabled.value) await load()
  }
  const restore = async (depth = 60, id?: string | null) => {
    const state = current.value, ownKey = key.value
    // Only follow pages belonging to the still-current navigation. Failures remain retryable.
    while (key.value === ownKey && enabled.value && !disposed) {
      if (state.busy) { await new Promise(resolve => setTimeout(resolve, 20)); continue }
      if (!state.started) { await load(state); if (state.error) return; continue }
      if (!state.cursor || (state.ids.length >= depth && (!id || state.ids.includes(id)))) return
      await load(state, true); if (state.error) return
    }
  }
  const selectAll = () => api<string[]>('/api/library/ids', { query: query.value })
  return { current, enabled, query, key, images, merge, activate, load, more: () => load(current.value, true), refresh, restore, selectAll }
}
