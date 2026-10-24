import type { ImageRecord } from '../types/image'

type Page = {
  state: 'preparing' | 'failed' | 'unavailable' | 'ready'
  images: ImageRecord[]; snapshot: string | null; nextOffset: number | null
  partial: boolean; preparedCount: number; totalCount: number; failedCount: number
}
type Session = Page & { referenceId: string; busy: boolean; error: string; expired: boolean; started: boolean }
const session = (referenceId = ''): Session => ({ referenceId, state: 'preparing', images: [], snapshot: null, nextOffset: null, partial: false,
  preparedCount: 0, totalCount: 0, failedCount: 0, busy: false, error: '', expired: false, started: false })

export function useSimilarImages(referenceId: Ref<string | null>) {
  const $fetch = useNuxtApp().$libraryApi
  const sessions = new Map<string, Session>()
  const current = shallowRef<Session>(reactive(session()))
  let poll: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  async function load(state: Session, next = false) {
    if (state.busy || !state.referenceId || disposed) return
    state.busy = true
    state.error = ''
    try {
      const page = await $fetch<Page>(`/api/images/${encodeURIComponent(state.referenceId)}/similar`, {
        query: next ? { snapshot: state.snapshot, offset: String(state.nextOffset) } : undefined,
      })
      const ids = new Set(state.images.map(image => image.id))
      state.images = next ? [...state.images, ...page.images.filter(image => !ids.has(image.id))] : page.images
      Object.assign(state, { ...page, images: state.images, expired: false, started: true })
      if (page.state === 'preparing' && current.value === state && !disposed) {
        poll = setTimeout(() => { void load(state) }, 2000)
      }
    } catch (error) {
      state.expired = (error as { statusCode?: number }).statusCode === 410
      state.error = state.expired ? 'These results expired. Refresh similar images.'
        : (error as { statusCode?: number }).statusCode === 404 ? 'This reference is no longer available.' : 'Could not load similar images. Try again.'
    } finally { state.busy = false }
  }
  watch(referenceId, id => {
    if (poll) clearTimeout(poll)
    if (!id) { current.value = reactive(session()); return }
    let state = sessions.get(id)
    if (!state) {
      state = reactive(session(id))
      if (sessions.size >= 20) sessions.delete(sessions.keys().next().value!)
      sessions.set(id, state)
    }
    current.value = state
    if (import.meta.client && (!state.started || state.state === 'preparing')) void load(state)
  }, { immediate: true })
  onMounted(() => { if (referenceId.value && !current.value.started) void load(current.value) })
  onBeforeUnmount(() => { disposed = true; if (poll) clearTimeout(poll) })
  const more = () => { const state = current.value; if (state.nextOffset !== null && !state.error) void load(state, true) }
  const refresh = () => {
    if (current.value.busy) return
    if (poll) clearTimeout(poll)
    const state = reactive(session(current.value.referenceId))
    sessions.set(state.referenceId, state)
    current.value = state
    void load(state)
  }
  const retry = async () => {
    const state = current.value
    if (state.busy) return
    if (state.state === 'failed' || state.state === 'unavailable') {
      state.busy = true
      try { await $fetch(`/api/images/${encodeURIComponent(state.referenceId)}/similar/retry`, { method: 'POST' }) }
      catch { state.error = 'Could not prepare similar images. Try again.'; return }
      finally { state.busy = false }
      if (state === current.value) refresh()
    } else if (state.expired) refresh()
    else void load(state, Boolean(state.snapshot && state.images.length))
  }
  const remove = (id: string) => { for (const state of sessions.values()) state.images = state.images.filter(image => image.id !== id) }
  return { current, more, refresh, retry, remove }
}
