import type { ImageRecord } from '../types/image'
type Status = { state: 'inactive' | 'preparing' | 'ready' | 'unavailable'; totalCount: number; preparedCount: number; failedCount: number; partial: boolean }
type Session = Status & { images: ImageRecord[]; busy: boolean; error: string; started: boolean }
const empty = (): Session => ({ state: 'inactive', totalCount: 0, preparedCount: 0, failedCount: 0, partial: false, images: [], busy: false, error: '', started: false })
export function useContentSearch(active: Ref<boolean>, query: Ref<string>, tagIds: Ref<string[]>) {
  const $fetch = useNuxtApp().$libraryApi
  const sessions = new Map<string, Session>()
  const current = shallowRef<Session>(reactive(empty()))
  let revision = 0, poll: ReturnType<typeof setTimeout> | undefined, disposed = false
  const key = () => JSON.stringify([query.value.trim(), [...tagIds.value].sort()])
  function cancelPoll() { if (poll) clearTimeout(poll); poll = undefined }
  async function load(state = current.value, force = false) {
    if (!import.meta.client || disposed || !active.value || state.busy) return
    if (state.started && state.state === 'ready' && !force) return
    const token = revision, text = query.value.trim(), tags = [...tagIds.value]
    state.busy = true; state.error = ''
    try {
      const response = text ? await $fetch<Status & { images: ImageRecord[] }>('/api/search/content', { method: 'POST', body: { query: text, tagIds: tags } })
        : await $fetch<Status>('/api/search/content/status')
      if (disposed || token !== revision) return
      Object.assign(state, response, { images: 'images' in response ? response.images : [], started: true })
      if (state.state === 'preparing') poll = setTimeout(() => { void load(state, true) }, 2000)
    } catch {
      if (token === revision) state.error = 'Could not search by content. Try again or use tags and filename.'
    } finally {
      state.busy = false
      if (!disposed && active.value && token !== revision && current.value === state && (!state.started || state.state !== 'ready')) void load(state, true)
    }
  }
  async function prepare() {
    if (current.value.busy) return
    const token = revision, state = current.value
    state.busy = true; state.error = ''
    try {
      await $fetch('/api/search/content/prepare', { method: 'POST' })
      if (token !== revision || disposed) return
      state.started = false
    } catch { if (token === revision) state.error = 'Could not prepare content search. Try again.' }
    finally { state.busy = false }
    if (token === revision) await load(state, true)
  }
  watch([active, query, () => tagIds.value.join('\u0000')], () => {
    cancelPoll(); revision++
    if (!active.value) return
    const id = key()
    let state = sessions.get(id)
    if (!state) { state = reactive(empty()); if (sessions.size >= 20) sessions.delete(sessions.keys().next().value!); sessions.set(id, state) }
    current.value = state
    void load(state)
  }, { immediate: true })
  onMounted(() => { if (active.value) void load() })
  onBeforeUnmount(() => { disposed = true; revision++; cancelPoll() })
  const remove = (id: string) => { for (const state of sessions.values()) state.images = state.images.filter(image => image.id !== id) }
  return { current, prepare, remove, refresh: () => { cancelPoll(); void load(current.value, true) } }
}
