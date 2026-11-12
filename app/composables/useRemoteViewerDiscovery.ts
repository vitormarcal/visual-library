import type { ImageRecord } from '../types/image'

type RelatedPage = { images: ImageRecord[]; nextOffset: number | null; hasCandidates: boolean }
export function useRemoteViewerDiscovery(image: Ref<ImageRecord | null>, merge: (images: ImageRecord[]) => void) {
  const api = useNuxtApp().$libraryApi
  const shared = ref<ImageRecord[]>([]), fallback = ref<ImageRecord[]>([]), offset = ref<number | null>(null), busy = ref(false), activated = ref(false)
  const reference = computed(() => activated.value && image.value && !image.value.hiddenFromGallery ? image.value.id : null)
  const similar = useSimilarImages(reference)
  let version = 0, disposed = false
  const error = ref(false), retryMore = ref(false)
  async function load(more = false) {
    if (!image.value || busy.value || disposed || (more && offset.value === null)) return
    const ownVersion = version, id = image.value.id
    busy.value = true; error.value = false
    try {
      const page = await api<RelatedPage>('/api/library/related', { query: { id, ...(more ? { offset: offset.value! } : {}) } })
      if (disposed || ownVersion !== version) return
      merge(page.images)
      if (more) fallback.value = [...fallback.value, ...page.images]
      else shared.value = page.images
      offset.value = page.nextOffset
    } catch { if (ownVersion === version) { error.value = true; retryMore.value = more } }
    finally { if (ownVersion === version) busy.value = false }
  }
  watch(() => image.value ? `${image.value.id}:${image.value.hiddenFromGallery}:${image.value.tags.map(tag => tag.id).join(',')}` : '', () => {
    version++; shared.value = []; fallback.value = []; offset.value = null; activated.value = false; busy.value = false; error.value = false
    if (import.meta.client) void load()
  }, { immediate: true })
  onMounted(() => { if (image.value && !shared.value.length) void load() })
  onBeforeUnmount(() => { disposed = true; version++ })
  watch(() => similar.current.value.images, incoming => merge(incoming))
  const images = computed(() => {
    const seen = new Set([image.value?.id])
    return [...shared.value, ...similar.current.value.images, ...fallback.value].filter(candidate => {
      if (seen.has(candidate.id) || candidate.hiddenFromGallery !== image.value?.hiddenFromGallery) return false
      seen.add(candidate.id); return true
    })
  })
  const more = () => {
    if (error.value) { void load(retryMore.value); return }
    if (!activated.value) { activated.value = true; if (!image.value?.hiddenFromGallery) return }
    if (similar.current.value.nextOffset !== null && !similar.current.value.error) { similar.more(); return }
    if (offset.value !== null) void load(true)
  }
  return { images, busy: computed(() => busy.value || similar.current.value.busy), hasMore: computed(() => error.value || offset.value !== null || similar.current.value.nextOffset !== null || (!activated.value && shared.value.length > 0)), more }
}
