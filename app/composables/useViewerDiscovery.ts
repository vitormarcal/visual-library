import type { ImageRecord } from '../types/image'
import { viewerDiscoveryImages } from '../utils/related-images'

export function useViewerDiscovery(image: Ref<ImageRecord | null>, candidates: Ref<ImageRecord[]>) {
  const activated = reactive(new Set<string>())
  const fallbackCounts = reactive(new Map<string, number>())
  const referenceId = computed(() => image.value && !image.value.hiddenFromGallery && activated.has(image.value.id) ? image.value.id : null)
  const similarity = useSimilarImages(referenceId)
  const state = computed(() => similarity.current.value.referenceId === image.value?.id ? similarity.current.value : null)
  const images = computed(() => image.value
    ? viewerDiscoveryImages(image.value, candidates.value, state.value?.images ?? [], fallbackCounts.get(image.value.id) ?? 0)
    : [])
  const busy = computed(() => Boolean(referenceId.value && (!state.value || state.value.busy
    || (!state.value.error && state.value.state === 'preparing'))))
  const hasMore = computed(() => {
    if (!image.value || !candidates.value.some(candidate => candidate.id !== image.value!.id)) return false
    if (!activated.has(image.value.id) || busy.value) return true
    if (state.value && !state.value.error && state.value.state === 'ready' && state.value.nextOffset !== null) return true
    return viewerDiscoveryImages(image.value, candidates.value, state.value?.images ?? [], Infinity).length > images.value.length
  })
  const more = () => {
    const selected = image.value
    if (!selected || busy.value || !hasMore.value) return
    if (!activated.has(selected.id)) {
      activated.add(selected.id)
      if (!selected.hiddenFromGallery) return
    }
    if (state.value && !state.value.error && state.value.state === 'ready' && state.value.nextOffset !== null) {
      similarity.more()
      return
    }
    fallbackCounts.set(selected.id, (fallbackCounts.get(selected.id) ?? 0) + 24)
  }
  return { images, busy, hasMore, more }
}
