<script setup lang="ts">
import SaveDropzone from './SaveDropzone.vue'
import { createRediscoveryBatches } from '../utils/rediscovery'
import { discoveryImages } from '../utils/image-visibility'
import { sharedCaptureKeys, sharedCaptureMessage } from '../utils/shared-capture'
import { matchesImageSearch } from '../utils/image-search'
import type { PageDiscovery } from '../utils/page-image-selection'
import { saveImageBatch, type UploadResult } from '../utils/image-upload'
import { groupImagesByTag } from '../utils/tag-exploration'
import { libraryDestination, libraryDestinationUrl, interceptLibraryLink } from '../utils/library-navigation'
import { recordViewerVisit, popViewerVisit, type ViewerHistoryEntry, type ViewerPosition } from '../utils/viewer-history'
import type { ImageRecord, ImageTag } from '../types/image'
const $fetch = useNuxtApp().$libraryApi
type TagSummary = ImageTag & {
  imageCount: number
  lastUsedAt: string
  coverImageId: string | null
}

type DuplicateSaveResponse = {
  duplicate: true
  message: string
}

type SaveImageResponse = ImageRecord | DuplicateSaveResponse

const readingUrl = ref(false)
const pageCapture = shallowRef<PageDiscovery | null>(null)
const focusAddImages = () => Array.from(document.querySelectorAll<HTMLElement>('[data-add-images]')).find(element => element.getClientRects().length)?.focus({ preventScroll: true })
const closePageCapture = async () => {
  pageCapture.value = null
  await nextTick()
  if (captureOpen.value) captureSurface.value?.focus()
  else focusAddImages()
}
const uploadLimit = Number(useRuntimeConfig().public.maxImageSizeBytes)
const images = ref<ImageRecord[]>([])
const librarySummary = computed(() => {
  const tags = new Set<string>()
  let bytes = 0
  for (const image of images.value) {
    bytes += image.sizeBytes
    for (const tag of image.tags) tags.add(tag.id)
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unit = bytes > 0 ? Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1) : 0
  const numbers = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })
  return {
    images: `${numbers.format(images.value.length)} ${images.value.length === 1 ? 'image' : 'images'}`,
    tags: `${numbers.format(tags.size)} ${tags.size === 1 ? 'tag' : 'tags'}`,
    size: `${numbers.format(bytes / 1000 ** unit)} ${units[unit]}`,
  }
})
const publicImages = computed(() => discoveryImages(images.value))
const eligibleImages = computed(() => discoveryImages(images.value, destination.value.hidden))
const loading = ref(true)
const saving = ref(false)
const uploadProgress = ref<{ current: number; total: number } | null>(null)
const uploadResult = shallowRef<UploadResult | null>(null)
const notice = ref('')
const noticeKind = ref<'success' | 'error'>('success')
const sharedNotice = ref(sharedCaptureMessage(useRequestURL().searchParams))
const navigation = useLibraryNavigation()
const destination = navigation.destination
const contentMode = computed(() => destination.value.screen === 'library' && !destination.value.hidden && destination.value.searchMode === 'content' && !destination.value.problem)
const contentQuery = computed(() => contentMode.value ? destination.value.query : '')
const contentTagIds = computed(() => contentMode.value ? destination.value.tagIds : [])
const content = useContentSearch(contentMode, contentQuery, contentTagIds)
watch(() => content.current.value.images, incoming => {
  const existing = new Set(images.value.map(image => image.id))
  images.value = [...images.value, ...incoming.filter(image => !existing.has(image.id))]
})
const contentDraft = ref(destination.value.query)
watch(() => [destination.value.query, destination.value.searchMode], () => { contentDraft.value = destination.value.query })
const submitContentSearch = () => {
  if (!contentMode.value) return
  if (destination.value.query === contentDraft.value.trim()) content.refresh()
  else navigation.replace({ ...destination.value, query: contentDraft.value.trim(), imageId: null })
}
const setSearchMode = (searchMode: 'text' | 'content') => {
  if (destination.value.searchMode === searchMode) return
  contentDraft.value = ''
  navigation.replace({ ...destination.value, searchMode, query: '', imageId: null })
}
const contentInitialLoading = computed(() => contentMode.value && content.current.value.busy && !content.current.value.images.length)

const referenceId = computed(() => destination.value.screen === 'similar' ? destination.value.referenceId : null)
const similarity = useSimilarImages(referenceId)
const referenceImage = computed(() => publicImages.value.find(image => image.id === referenceId.value) ?? null)
const similarInitialLoading = computed(() => destination.value.screen === 'similar' && similarity.current.value.busy && !similarity.current.value.images.length)
watch(() => similarity.current.value.images, incoming => {
  const existing = new Set(images.value.map(image => image.id))
  images.value = [...images.value, ...incoming.filter(image => !existing.has(image.id))]
})
const selectedImageId = computed({ get: () => destination.value.imageId, set: (imageId: string | null) => navigation.replace({ ...destination.value, imageId }) })
const returnFocusImageId = ref<string | null>(null)
const viewerHistory = ref<ViewerHistoryEntry[]>([])
const viewerRestoration = ref<(ViewerHistoryEntry & { token: number }) | null>(null)
let viewerTransition = 0
const canGoBack = computed(() => viewerHistory.value.some((entry) => eligibleImages.value.some((image) => image.id === entry.imageId)))
const tagSummaries = ref<TagSummary[]>([])
const pendingTagSaves = ref(new Set<string>())
const screen = computed(() => destination.value.screen)
const tagMetadata = ref<Record<string, ImageTag>>({})
const tagLookups = ref<Record<string, 'loading' | 'missing' | 'error'>>({})
const subjectTag = computed(() => destination.value.subjectId ? tagMetadata.value[destination.value.subjectId] ?? null : null)
const coverDimensions = ref<Record<string, { width: number; height: number }>>({})
const tagsLoading = ref(false)
const tagsError = ref(false)
const libraryError = ref(false)
let tagsRequest = 0
const galleryQuery = computed({
  get: () => contentMode.value ? contentDraft.value : destination.value.query,
  set: (query: string) => {
    if (contentMode.value) { contentDraft.value = query; if (!query) navigation.replace({ ...destination.value, query: '' }) }
    else navigation.replace({ ...destination.value, query })
  },
})
const exploreQuery = galleryQuery
const galleryFilters = computed(() => destination.value.tagIds.map((id) => tagMetadata.value[id]).filter((tag): tag is ImageTag => Boolean(tag)))
const baseTag = subjectTag
const effectiveFilters = computed(() => baseTag.value ? [baseTag.value, ...galleryFilters.value] : galleryFilters.value)
const requiredTagIds = computed(() => [...(destination.value.subjectId ? [destination.value.subjectId] : []), ...destination.value.tagIds])
const missingFilters = computed(() => destination.value.tagIds.filter((id) => tagLookups.value[id] === 'missing' && !tagMetadata.value[id]))
const resolvingDestination = computed(() => !loading.value && !libraryError.value && requiredTagIds.value.some((id) => !tagMetadata.value[id] && !['missing', 'error'].includes(tagLookups.value[id] ?? 'loading')))
const destinationError = computed(() => requiredTagIds.value.some((id) => !tagMetadata.value[id] && tagLookups.value[id] === 'error'))
const destinationUnavailable = computed(() => destination.value.problem || (!loading.value && !libraryError.value && screen.value === 'similar' && !referenceImage.value ? 'This reference is no longer available.' : null) || (destination.value.subjectId && !tagMetadata.value[destination.value.subjectId] && tagLookups.value[destination.value.subjectId] === 'missing' ? 'This subject is no longer available.' : null))
const destinationBlocked = computed(() => Boolean(destinationUnavailable.value || missingFilters.value.length || destinationError.value || resolvingDestination.value))
const title = computed(() => screen.value === 'subject' ? subjectTag.value?.name ?? 'Subject' : screen.value === 'explore' ? 'Explore' : screen.value === 'similar' ? 'Similar images' : screen.value === 'duplicates' ? 'Review duplicates' : 'Library')
useHead(() => ({ title: `${title.value} · Visual Library` }))
const navigationHref = (target: 'library' | 'explore') => libraryDestinationUrl(navigation.savedDestination(target))
const imageHref = (id: string) => libraryDestinationUrl({ ...destination.value, imageId: id })
const linkAction = (event: MouseEvent, action: () => void) => { if (interceptLibraryLink(event) && !applyingTags.value) action() }
const subjectImages = computed(() => subjectTag.value ? publicImages.value.filter((image) => image.tags.some((tag) => tag.id === subjectTag.value!.id)) : [])
const allSubjects = computed(() => groupImagesByTag(publicImages.value, tagSummaries.value))
const subjects = computed(() => groupImagesByTag(publicImages.value, tagSummaries.value, exploreQuery.value))
const rediscoveryBatches = createRediscoveryBatches()
const rediscovery = computed(() => rediscoveryBatches.get(destination.value.selectionId))
const rediscoveredImages = computed(() => {
  const current = new Map(publicImages.value.map(image => [image.id, image]))
  return (rediscovery.value?.ids ?? []).map(id => current.get(id)).filter((image): image is ImageRecord => Boolean(image))
})
const anotherSelection = () => {
  const selectionId = crypto.randomUUID()
  rediscoveryBatches.create(selectionId, publicImages.value, rediscovery.value?.ids)
  navigation.replace({ ...destination.value, selectionId, imageId: null })
}
// A batch belongs to this page session; never reconstruct a different lot under an old ID.
watch([() => destination.value.selectionId, () => destination.value.screen, loading, libraryError, () => publicImages.value.length], () => {
  if (loading.value || libraryError.value || destination.value.problem || screen.value !== 'explore') return
  if (rediscovery.value && (rediscovery.value.ids.length || !publicImages.value.length)) return
  if (destination.value.imageId) {
    navigation.replace({ ...libraryDestination(), imageId: destination.value.imageId })
    showNotice('This selection is no longer available. Opened the image in Library.', 'success')
  } else anotherSelection()
})
type PagePosition = { scrollTop: number; focusId: string | null }
let pageTransition = 0
let cancelPageRestoration = () => {}
const selecting = ref(false)
const selectedIds = ref<string[]>([])
const applyingTags = ref(false)
const bulkNotice = ref('')
const exitSelection = () => {
  if (applyingTags.value) return
  selecting.value = false
  selectedIds.value = []
  bulkNotice.value = ''
}
const toggleSelection = (id: string) => {
  if (applyingTags.value) return
  bulkNotice.value = ''
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((selected) => selected !== id)
    : [...selectedIds.value, id]
}
const applyBulkTags = async (tags: string[]) => {
  if (applyingTags.value || !selectedIds.value.length) return
  const operationKey = navigation.entry.value?.key
  const operationIds = [...selectedIds.value]
  const operationTags = [...tags]
  applyingTags.value = true
  bulkNotice.value = ''
  try {
    const response = await $fetch<{ images: { id: string; tags: ImageTag[] }[] }>('/api/images/tags', {
      method: 'POST', body: { imageIds: operationIds, tags: operationTags },
    })
    const updated = new Map(response.images.map((image) => [image.id, image.tags]))
    images.value = images.value.map((image) => updated.has(image.id) ? { ...image, tags: updated.get(image.id)! } : image)
    if (navigation.entry.value?.key === operationKey) {
      selectedIds.value = []
      bulkNotice.value = 'Tags added.'
    } else showNotice('Tags added to the selected images.', 'success')
    await loadTags()
  } catch (error) {
    const message = (error as { data?: { statusMessage?: string } }).data?.statusMessage
    const feedback = message === 'Tag is too long' ? 'Tag is too long.'
        : message === 'Image not found' ? 'An image no longer exists. Refresh the library and try again.'
          : 'Could not add tags. Try again.'
    if (navigation.entry.value?.key === operationKey) bulkNotice.value = feedback
    else showNotice(feedback, 'error')
  } finally { applyingTags.value = false }
}

const filterNotice = ref('')
const viewerFilterNotice = ref('')
let uploadResultTimer: ReturnType<typeof setTimeout> | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let filterNoticeTimer: ReturnType<typeof setTimeout> | undefined
let viewerFilterNoticeTimer: ReturnType<typeof setTimeout> | undefined

const visibleImages = computed(() => {
  if (contentMode.value) return destinationBlocked.value ? [] : content.current.value.images
    .map(image => images.value.find(current => current.id === image.id) ?? image)
    .filter(image => !image.hiddenFromGallery && destination.value.tagIds.every(id => image.tags.some(tag => tag.id === id)))
  if (screen.value === 'explore') return destinationBlocked.value ? [] : rediscoveredImages.value
  if (screen.value === 'similar') return destinationBlocked.value ? [] : similarity.current.value.images
    .map(image => images.value.find(current => current.id === image.id) ?? image).filter(image => !image.hiddenFromGallery)
  return eligibleImages.value.filter((image) => {
    const imageTags = new Set(image.tags.map((tag) => tag.normalizedName))
    return !destinationBlocked.value && matchesImageSearch(image, galleryQuery.value)
      && effectiveFilters.value.every((filter) => imageTags.has(filter.normalizedName))
  })
})

const hasLibraryTags = computed(() => galleryTagSummaries.value.length > 0)

const selectedImageIndex = computed(() => {
  if (!selectedImageId.value) {
    return -1
  }

  return visibleImages.value.findIndex((image) => image.id === selectedImageId.value)
})

const selectedImage = computed(() => !loading.value && !destinationBlocked.value ? eligibleImages.value.find((image) => image.id === selectedImageId.value) ?? null : null)

const hiddenLinkedImage = computed(() => !loading.value && !destination.value.hidden
  ? images.value.find(image => image.id === destination.value.imageId && image.hiddenFromGallery) ?? null : null)
const openHiddenLink = () => {
  const id = hiddenLinkedImage.value?.id
  if (!id) return
  navigation.push({ ...libraryDestination(), hidden: true })
  openViewer(id)
}
const toggleHiddenMode = () => {
  if (!applyingTags.value) navigation.push({ ...destination.value, hidden: !destination.value.hidden, searchMode: 'text', query: contentMode.value ? '' : destination.value.query, imageId: null })
}
const visibilityBusy = ref(new Set<string>())
const visibilityNotice = ref('')
const changeVisibility = async (id: string, hiddenFromGallery: boolean) => {
  if (visibilityBusy.value.has(id) || pendingTagSaves.value.has(id)) return
  const key = navigation.entry.value?.key
  visibilityBusy.value = new Set([...visibilityBusy.value, id])
  visibilityNotice.value = ''
  try {
    const response = await $fetch<ImageRecord>(`/api/images/${encodeURIComponent(id)}/visibility`, {
      method: 'PATCH', body: { hiddenFromGallery },
    })
    // Close before updating eligibility so the missing-image watcher cannot remove the parent.
    if (key === navigation.entry.value?.key && selectedImageId.value === id) {
      navigation.closeViewer()
      viewerHistory.value = []
      viewerRestoration.value = null
    }
    images.value = images.value.map(image => image.id === id ? { ...image, hiddenFromGallery: response.hiddenFromGallery } : image)
    showNotice(hiddenFromGallery ? 'Image hidden from gallery.' : 'Image shown in gallery.', 'success')
    await loadTags()
  } catch {
    if (key === navigation.entry.value?.key) visibilityNotice.value = 'Could not change visibility. Try again.'
    else showNotice('Could not change visibility. Try again.', 'error')
  } finally { visibilityBusy.value = new Set([...visibilityBusy.value].filter(value => value !== id)) }
}
const galleryTagSummaries = computed(() => {
  if (!destination.value.hidden) return tagSummaries.value
  const tags = new Map<string, TagSummary>()
  for (const image of eligibleImages.value) for (const tag of image.tags) {
    const summary = tags.get(tag.id) ?? { ...tag, imageCount: 0, lastUsedAt: image.createdAt, coverImageId: null }
    summary.imageCount++
    tags.set(tag.id, summary)
  }
  return [...tags.values()]
})

const viewerDiscovery = useViewerDiscovery(selectedImage, eligibleImages)
const relatedImages = viewerDiscovery.images

const hasPreviousImage = computed(() => selectedImageIndex.value > 0)
const hasNextImage = computed(() => selectedImageIndex.value >= 0 && selectedImageIndex.value < visibleImages.value.length - 1)

const showNotice = (message: string, kind: 'success' | 'error') => {
  notice.value = message
  noticeKind.value = kind

  if (noticeTimer) {
    clearTimeout(noticeTimer)
  }

  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 3200)
}

const isDuplicateSaveResponse = (response: SaveImageResponse): response is DuplicateSaveResponse => {
  return 'duplicate' in response && response.duplicate
}

const applySaveResponse = (response: SaveImageResponse) => {
  if (isDuplicateSaveResponse(response)) {
    showNotice(response.message, 'success')
    return
  }

  images.value = [response, ...images.value]
  showNotice('Saved.', 'success')
}

const showFilterNotice = (message: string) => {
  filterNotice.value = message

  if (filterNoticeTimer) {
    clearTimeout(filterNoticeTimer)
  }

  filterNoticeTimer = setTimeout(() => {
    filterNotice.value = ''
  }, 2200)
}

const showViewerFilterNotice = (message: string) => {
  viewerFilterNotice.value = message

  if (viewerFilterNoticeTimer) {
    clearTimeout(viewerFilterNoticeTimer)
  }

  viewerFilterNoticeTimer = setTimeout(() => {
    viewerFilterNotice.value = ''
  }, 2200)
}

const loadTags = async () => {
  const request = ++tagsRequest
  tagsLoading.value = true
  try {
    const tags = await $fetch<TagSummary[]>('/api/tags')
    if (request !== tagsRequest) return
    tagSummaries.value = tags
    for (const tag of tags) tagMetadata.value[tag.id] = tag
    tagsError.value = false
  } catch {
    if (request === tagsRequest) tagsError.value = true
  } finally {
    if (request === tagsRequest) tagsLoading.value = false
  }
}

const loadImages = async () => {
  loading.value = true
  libraryError.value = false

  try {
    const [loaded] = await Promise.all([$fetch<ImageRecord[]>('/api/images'), loadTags()])
    const loadedIds = new Set(loaded.map((image) => image.id))
    images.value = [...images.value.filter((image) => !loadedIds.has(image.id)), ...loaded]
    for (const image of images.value) for (const tag of image.tags) tagMetadata.value[tag.id] = tag
  } catch {
    libraryError.value = true
    showNotice('Could not load the library.', 'error')
  } finally {
    loading.value = false
  }
}

const clearCaptureNotice = () => {
  if (noticeTimer) clearTimeout(noticeTimer)
  if (uploadResultTimer) clearTimeout(uploadResultTimer)
  notice.value = ''
}

const captureTags = computed(() => screen.value === 'explore' || screen.value === 'similar' || destinationBlocked.value ? [] : effectiveFilters.value.map(tag => tag.name))
const batchTags = ref<string[]>([])

const handleSave = async (files: File[], retry = false) => {
  if (pageCapture.value) { showNotice('Save or close the page selection first.', 'error'); return }
  if (saving.value || !files.length) return
  if (!retry) batchTags.value = [...captureTags.value]
  const tags = [...batchTags.value]
  const previous = retry ? uploadResult.value ?? undefined : undefined
  saving.value = true
  clearCaptureNotice()
  uploadResult.value = null
  try {
    uploadResult.value = await saveImageBatch(files, async (file) => {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('tags', JSON.stringify(tags))
      const saved = await $fetch<SaveImageResponse>('/api/images', { method: 'POST', body: formData })
      if (isDuplicateSaveResponse(saved)) return 'duplicate'
      images.value = [saved, ...images.value]
      return 'saved'
    }, (current, total) => { uploadProgress.value = { current, total } }, previous, uploadLimit)
    void loadTags()
    if (!uploadResult.value.failures.length) {
      const result = uploadResult.value
      uploadResultTimer = setTimeout(() => { if (uploadResult.value === result) uploadResult.value = null }, 3200)
    }
  } finally {
    saving.value = false
    uploadProgress.value = null
  }
}

const retryFailedImages = () => {
  if (saving.value) return
  const files = uploadResult.value?.failures.filter((failure) => failure.retryable).map((failure) => failure.file) ?? []
  void handleSave(files, true)
}

const handleSaveUrl = async (url: string) => {
  if (pageCapture.value) { showNotice('Save or close the page selection first.', 'error'); return }
  if (saving.value) return
  const tags = [...captureTags.value]
  batchTags.value = tags
  readingUrl.value = true
  saving.value = true
  uploadResult.value = null
  clearCaptureNotice()
  try {
    const response = await $fetch<({ kind: 'image'; result: SaveImageResponse }) | ({ kind: 'page' } & PageDiscovery)>('/api/capture-url', { method: 'POST', body: { url, tags } })
    if (response.kind === 'page') pageCapture.value = response
    else applySaveResponse(response.result)
    void loadTags()
  } catch (error) {
    const message = (error as { data?: { statusMessage?: string } }).data?.statusMessage
    showNotice(message || 'This image URL cannot be saved.', 'error')
  } finally {
    saving.value = false
    readingUrl.value = false
  }
}

const applyDuplicateResolution = (result: { removedIds: string[]; images: ImageRecord[] }) => {
  const removed = new Set(result.removedIds), updated = new Map(result.images.map(image => [image.id, image]))
  images.value = images.value.filter(image => !removed.has(image.id)).map(image => updated.get(image.id) ?? image)
  for (const id of removed) { similarity.remove(id); content.remove(id) }
  void loadTags()
}

const handleDelete = async (id: string) => {
  try {
    await $fetch(`/api/images/${id}`, { method: 'DELETE' })
    images.value = images.value.filter((image) => image.id !== id)
    similarity.remove(id)
    content.remove(id)
    const retained = destination.value.tagIds.filter((tagId) => images.value.some((image) => image.tags.some((tag) => tag.id === tagId)))
    if (retained.length !== destination.value.tagIds.length) {
      navigation.replace({ ...destination.value, tagIds: retained })
      showFilterNotice('Filters with no remaining images were removed.')
    }
    void loadTags()
  } catch {
    showNotice('Could not remove this image.', 'error')
  }
}

const addTagFilter = (tag: ImageTag) => {
  if (effectiveFilters.value.some((filter) => filter.normalizedName === tag.normalizedName)) {
    return true
  }

  if (destination.value.tagIds.length + (baseTag.value ? 1 : 0) >= 3) {
    showFilterNotice('Too many filters')
    return false
  }

  tagMetadata.value[tag.id] = tag
  navigation.replace({ ...destination.value, tagIds: [...destination.value.tagIds, tag.id] })
  return true
}

const removeTagFilter = (normalizedName: string) => {
  navigation.replace({ ...destination.value, tagIds: destination.value.tagIds.filter((id) => tagMetadata.value[id]?.normalizedName !== normalizedName) })
}

const clearTagFilters = () => {
  navigation.replace({ ...destination.value, query: '', tagIds: [] })
}

const handleViewerTagFilter = (tag: ImageTag) => {
  if (screen.value === 'similar' || screen.value === 'explore') {
    tagMetadata.value[tag.id] = tag
    navigation.push({ ...libraryDestination(), tagIds: [tag.id] })
    return
  }
  if (addTagFilter(tag)) {
    viewerFilterNotice.value = ''
    navigation.closeViewer({ ...destination.value, imageId: null })
  } else {
    showViewerFilterNotice('Too many filters')
  }
}

const saveImageTags = async (id: string, tags: string[]): Promise<ImageTag[]> => {
  if (pendingTagSaves.value.has(id)) throw new Error('Tags are already being saved.')
  pendingTagSaves.value = new Set([...pendingTagSaves.value, id])
  try {
    const response = await $fetch<{ tags: ImageTag[] }>(`/api/images/${id}/tags`, {
      method: 'PUT', body: { tags },
    })
    images.value = images.value.map((image) => image.id === id ? { ...image, tags: response.tags } : image)
    void loadTags()
    return response.tags
  } finally {
    pendingTagSaves.value = new Set([...pendingTagSaves.value].filter((pendingId) => pendingId !== id))
  }
}

const restorePage = async (position: PagePosition, selector: string, transition: number) => {
  await nextTick()
  if (transition !== pageTransition) return
  const fallback = screen.value === 'explore' ? '[data-explore-search]' : screen.value === 'similar' ? '[data-similar-heading]' : '[data-library-search]'
  const origin = document.querySelector<HTMLElement>(selector) ?? document.querySelector<HTMLElement>(fallback)
  origin?.focus({ preventScroll: true })
  const correctScroll = () => window.scrollTo({ top: Math.min(position.scrollTop, Math.max(0, document.documentElement.scrollHeight - window.innerHeight)), behavior: 'instant' })
  correctScroll()
  const observer = new ResizeObserver(correctScroll)
  observer.observe(document.querySelector('main')!)
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
  const cancel = () => {
    observer.disconnect()
    clearTimeout(timeout)
    for (const event of events) window.removeEventListener(event, cancel, true)
  }
  const timeout = setTimeout(cancel, 2000)
  for (const event of events) window.addEventListener(event, cancel, { capture: true, passive: true })
  cancelPageRestoration = cancel
}

const resetPageInteraction = () => {
  cancelPageRestoration()
  pageTransition += 1
  selecting.value = false
  selectedIds.value = []
  bulkNotice.value = ''
  returnFocusImageId.value = null
  viewerHistory.value = []
  viewerRestoration.value = null
  viewerTransition += 1
  filterNotice.value = ''
  viewerFilterNotice.value = ''
}

const showExplore = () => {
  if (applyingTags.value) return
  if (screen.value === 'subject') navigation.returnToExplore()
  else navigation.push(navigation.savedDestination('explore'))
}
const showLibrary = () => { if (!applyingTags.value) navigation.push(navigation.savedDestination('library')) }
const openSubject = (tag: ImageTag) => {
  if (applyingTags.value) return
  tagMetadata.value[tag.id] = tag
  navigation.push({ ...libraryDestination('subject'), subjectId: tag.id }, tag.id)
}
const resolveDestinationTags = async (retry = false) => {
  if (loading.value || libraryError.value || destination.value.problem) return
  await Promise.all(requiredTagIds.value.map(async (id) => {
    if (tagMetadata.value[id] || (tagLookups.value[id] && !retry)) return
    tagLookups.value[id] = 'loading'
    try {
      const tag = await $fetch<ImageTag>(`/api/tags/${encodeURIComponent(id)}`)
      tagMetadata.value[id] = tag
      delete tagLookups.value[id]
    } catch (error) {
      tagLookups.value[id] = (error as { statusCode?: number }).statusCode === 404 ? 'missing' : 'error'
    }
  }))
}
const removeUnavailableFilter = (id: string) => navigation.replace({ ...destination.value, tagIds: destination.value.tagIds.filter((tagId) => tagId !== id) })
const clearAddressRefinements = () => navigation.push(destination.value.subjectId ? { ...libraryDestination('subject'), subjectId: destination.value.subjectId } : libraryDestination())
const recoverExplore = () => navigation.push(libraryDestination('explore'))
watch([() => destination.value.subjectId, () => destination.value.tagIds.join('\u0000'), loading], () => { void resolveDestinationTags() })

let interactionKey: string | null = null
let restoredKey: string | null = null
let closingFocusId: string | null = null
watch([() => navigation.entry.value?.key, loading, destinationBlocked, similarInitialLoading, contentInitialLoading], async ([key]) => {
  if (!key) return
  if (key !== interactionKey) {
    closingFocusId = destination.value.imageId ? null : returnFocusImageId.value
    resetPageInteraction()
    interactionKey = key
    restoredKey = null
    if (destination.value.imageId) returnFocusImageId.value = navigation.entry.value?.parent?.focusId ?? destination.value.imageId
  }
  if (loading.value || similarInitialLoading.value || contentInitialLoading.value || destinationBlocked.value || libraryError.value || restoredKey === key || destination.value.imageId) return
  restoredKey = key
  const state = navigation.entry.value!
  if (closingFocusId) {
    const selector = `[data-lightbox-open-id="${CSS.escape(closingFocusId)}"]`
    closingFocusId = null
    void restorePage(state, selector, pageTransition)
    return
  }
  if (navigation.mode.value === 'push' && (screen.value === 'subject' || screen.value === 'similar' || screen.value === 'duplicates')) {
    await nextTick()
    if (navigation.entry.value?.key !== key) return
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector<HTMLElement>(screen.value === 'duplicates' ? '[data-duplicate-page-heading]' : screen.value === 'similar' ? '[data-similar-heading]' : '[data-subject-heading]')?.focus({ preventScroll: true })
  } else if (!destination.value.imageId) {
    const selector = state.focusId ? screen.value === 'explore'
      ? `[data-explore-tag-id="${CSS.escape(state.focusId)}"], [data-lightbox-open-id="${CSS.escape(state.focusId)}"]`
      : `[data-lightbox-open-id="${CSS.escape(state.focusId)}"]`
      : screen.value === 'explore' ? '[data-rediscovery-heading]' : screen.value === 'similar' ? '[data-similar-heading]' : '[data-library-search]'
    void restorePage(state, selector, pageTransition)
  }
})
watch([selectedImage, loading, destinationBlocked], () => {
  if (loading.value || destinationBlocked.value || libraryError.value || (destination.value.imageId && visibilityBusy.value.has(destination.value.imageId))) return
  if (selectedImage.value) navigation.ensureViewerParent()
  else if (destination.value.imageId && !hiddenLinkedImage.value) {
    navigation.replace({ ...destination.value, imageId: null })
    showNotice('This image is no longer in the library.', 'error')
  }
})

const retrySubjects = () => { if (libraryError.value) void loadImages(); else void loadTags() }
const rememberCoverDimensions = (id: string, width: number, height: number) => {
  if (width && height) coverDimensions.value[id] = { width, height }
}

const openViewer = (id: string) => {
  visibilityNotice.value = ''
  cancelPageRestoration()
  viewerHistory.value = []
  viewerRestoration.value = null
  viewerTransition += 1
  returnFocusImageId.value = id
  navigation.push({ ...destination.value, imageId: id }, id)
}

const refreshSimilar = () => {
  if (similarity.current.value.busy) return
  similarity.refresh()
  window.scrollTo({ top: 0, behavior: 'instant' })
  document.querySelector<HTMLElement>('[data-similar-heading]')?.focus({ preventScroll: true })
}
const retrySimilar = () => similarity.current.value.expired ? refreshSimilar() : similarity.retry()
const closeViewer = () => navigation.closeViewer()

const navigateViewer = (id: string | undefined, position: ViewerPosition, related = false) => {
  if (!id || !selectedImageId.value || !eligibleImages.value.some((image) => image.id === id) || id === selectedImageId.value) return
  viewerHistory.value = recordViewerVisit(viewerHistory.value, selectedImageId.value, id, position, related)
  viewerRestoration.value = null
  viewerTransition += 1
  selectedImageId.value = id
}

const openRelatedImage = (id: string, position: ViewerPosition) => navigateViewer(id, position, true)
const showPreviousImage = (position: ViewerPosition) => {
  if (hasPreviousImage.value) navigateViewer(visibleImages.value[selectedImageIndex.value - 1]?.id, position)
}
const showNextImage = (position: ViewerPosition) => {
  if (hasNextImage.value) navigateViewer(visibleImages.value[selectedImageIndex.value + 1]?.id, position)
}
const goBackInViewer = () => {
  const { entry, history } = popViewerVisit(viewerHistory.value, new Set(eligibleImages.value.map((image) => image.id)))
  viewerHistory.value = history
  if (!entry) return false
  viewerRestoration.value = { ...entry, token: ++viewerTransition }
  selectedImageId.value = entry.imageId
  return true
}

const captureActionLabel = computed(() => readingUrl.value ? 'Reading URL…' : saving.value ? uploadProgress.value ? `Saving ${uploadProgress.value.current} of ${uploadProgress.value.total}…` : 'Saving…' : 'Add images')
const captureOpen = ref(false)
const captureSurface = ref<InstanceType<typeof SaveDropzone> | null>(null)
const filtersDialog = ref<HTMLDialogElement | null>(null)
const settingsDialog = ref<HTMLDialogElement | null>(null)
const infoDialog = ref<HTMLDialogElement | null>(null)
const dropActive = ref(false)
let dragDepth = 0
let captureTrigger: HTMLElement | null = null
const headerDraft = ref('')
const viewerSearchDraft = ref<string | null>(null)
const headerQuery = computed({
  get: () => screen.value === 'similar' || screen.value === 'duplicates' ? headerDraft.value : viewerSearchDraft.value ?? galleryQuery.value,
  set: (value: string) => {
    if (screen.value === 'similar' || screen.value === 'duplicates') { headerDraft.value = value; return }
    if (destination.value.imageId) {
      viewerSearchDraft.value = value
      navigation.closeViewer({ ...destination.value, imageId: null, query: value })
      return
    }
    galleryQuery.value = value
  },
})
const searchScope = computed(() => contentMode.value ? 'Describe an image · content search' : screen.value === 'explore' ? 'Search subjects' : screen.value === 'subject' ? `Search in ${subjectTag.value?.name ?? 'this subject'}` : screen.value === 'similar' || screen.value === 'duplicates' ? 'Search library · press Enter' : destination.value.hidden ? 'Search hidden images' : 'Search your library')
const searchTags = computed(() => screen.value === 'similar' || screen.value === 'duplicates' ? [] : screen.value === 'explore' ? tagSummaries.value : galleryTagSummaries.value.filter(tag => !effectiveFilters.value.some(active => active.id === tag.id)))
const submitHeaderSearch = () => {
  if (screen.value === 'similar' || screen.value === 'duplicates') {
    navigation.push({ ...libraryDestination(), query: headerDraft.value }); headerDraft.value = ''
  } else if (contentMode.value) submitContentSearch()
}
const selectSearchTag = (tag: ImageTag) => {
  if (screen.value === 'explore') openSubject(tag)
  else if (selectedImage.value) handleViewerTagFilter(tag)
  else if (addTagFilter(tag) && !contentMode.value) galleryQuery.value = ''
}
const searchEntireLibrary = () => navigation.push({ ...libraryDestination(), query: galleryQuery.value, tagIds: [...destination.value.tagIds] })
const revealCapture = async () => {
  await nextTick()
  cancelPageRestoration()
  pageTransition += 1
  captureSurface.value?.focus()
}
const openCapture = async (event?: Event) => {
  captureTrigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null
  captureOpen.value = true
  if (destination.value.imageId) { navigation.closeViewer(); return }
  await revealCapture()
}
watch(() => destination.value.imageId, async id => {
  if (id) return
  if (viewerSearchDraft.value !== null) {
    galleryQuery.value = viewerSearchDraft.value
    viewerSearchDraft.value = null
    await nextTick()
    document.querySelector<HTMLInputElement>('.libraryHeader input')?.focus({ preventScroll: true })
  } else if (captureOpen.value) await revealCapture()
})
const collapseCapture = () => {
  if (saving.value || readingUrl.value) return
  captureOpen.value = false
  if (captureTrigger?.isConnected && captureTrigger.getClientRects().length) captureTrigger.focus({ preventScroll: true })
  else focusAddImages()
}
const captureTargetBlocked = (event: Event) => event.defaultPrevented || Boolean(document.querySelector('dialog[open], [aria-modal="true"]')) || (event.target instanceof Element && Boolean(event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')))
const globalPaste = (event: ClipboardEvent) => {
  if (captureTargetBlocked(event)) return
  captureSurface.value?.handlePaste(event)
  if (event.defaultPrevented) { captureOpen.value = true; if (destination.value.imageId) navigation.closeViewer() }
}
const globalDrag = (event: DragEvent) => {
  if (!event.dataTransfer?.types.includes('Files') || captureTargetBlocked(event)) return
  event.preventDefault()
  if (event.type === 'dragenter') dragDepth++
  dropActive.value = true
}
const globalDragLeave = () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dropActive.value = false }
const globalDrop = (event: DragEvent) => {
  dragDepth = 0; dropActive.value = false
  if (!event.dataTransfer?.types.includes('Files') || captureTargetBlocked(event)) return
  captureOpen.value = true
  captureSurface.value?.handleDrop(event)
  if (destination.value.imageId) navigation.closeViewer()
}
const resetDrop = () => { dragDepth = 0; dropActive.value = false }

onMounted(() => {
  const url = new URL(location.href)
  if (url.searchParams.has('shared')) {
    for (const key of sharedCaptureKeys) url.searchParams.delete(key)
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }
  navigation.start()
  document.addEventListener('paste', globalPaste)
  document.addEventListener('dragenter', globalDrag)
  document.addEventListener('dragover', globalDrag)
  document.addEventListener('dragleave', globalDragLeave)
  document.addEventListener('drop', globalDrop)
  window.addEventListener('blur', resetDrop)
  void loadImages()
})

onBeforeUnmount(() => {
  navigation.stop()
  document.removeEventListener('paste', globalPaste)
  document.removeEventListener('dragenter', globalDrag)
  document.removeEventListener('dragover', globalDrag)
  document.removeEventListener('dragleave', globalDragLeave)
  document.removeEventListener('drop', globalDrop)
  window.removeEventListener('blur', resetDrop)
  cancelPageRestoration()
  pageTransition += 1
  tagsRequest += 1
  if (uploadResultTimer) clearTimeout(uploadResultTimer)
  if (noticeTimer) clearTimeout(noticeTimer)
  if (filterNoticeTimer) clearTimeout(filterNoticeTimer)
  if (viewerFilterNoticeTimer) clearTimeout(viewerFilterNoticeTimer)
})

watch(visibleImages, () => {
  const visibleIds = new Set(visibleImages.value.map((image) => image.id))
  selectedIds.value = selectedIds.value.filter((id) => visibleIds.has(id))
})

</script>

<template>
  <div class="libraryApp" @keydown.esc="selecting && exitSelection()">
    <a class="librarySkip" href="#library-content">Skip to images</a>
    <nav class="libraryRail" aria-label="Library navigation">
      <a class="libraryBrand" :href="libraryDestinationUrl(libraryDestination())" aria-label="Visual Library" @click="linkAction($event, showLibrary)">V</a>
      <a :href="navigationHref('library')" :aria-current="screen === 'library' || screen === 'similar' ? 'page' : undefined" :aria-disabled="applyingTags || undefined" aria-label="Library" title="Library" @click="linkAction($event, showLibrary)"><LibraryIcon name="library" /></a>
      <a :href="navigationHref('explore')" :aria-current="screen === 'explore' || screen === 'subject' ? 'page' : undefined" :aria-disabled="applyingTags || undefined" aria-label="Explore" title="Explore" @click="linkAction($event, showExplore)"><LibraryIcon name="explore" /></a>
      <button type="button" aria-label="Add images" title="Add images" @click="openCapture"><LibraryIcon name="add" /></button>
      <button type="button" class="railSettings" aria-label="Settings" title="Settings" @click="settingsDialog?.showModal()"><LibraryIcon name="settings" /></button>
    </nav>
    <header class="libraryHeader">
      <LibrarySearch v-model="headerQuery" :scope="searchScope" :explore="screen === 'explore'" :content="contentMode" :disabled="applyingTags" :tags="searchTags" @submit="submitHeaderSearch" @select="selectSearchTag" />
      <button type="button" data-add-images class="shellPrimary headerAdd" :class="{ captureSecondary: pageCapture || captureOpen || saving || readingUrl }" :aria-expanded="captureOpen" aria-controls="library-capture" @click="openCapture"><LibraryIcon name="add" /><span aria-live="polite">{{ captureActionLabel }}</span></button>
      <button type="button" class="shellIcon headerSettings" aria-label="Settings" @click="settingsDialog?.showModal()"><LibraryIcon name="settings" /></button>
    </header>
    <main id="library-content" class="page" tabindex="-1">
    <div :inert="selectedImage ? true : undefined">
    <header class="topbar">
      <div>
        <h1 v-if="screen === 'subject'" data-subject-heading tabindex="-1">{{ title }}</h1>
        <h1 v-else-if="screen === 'similar'" data-similar-heading tabindex="-1">Similar images</h1>
        <h1 v-else :data-duplicate-page-heading="screen === 'duplicates' ? '' : undefined" :tabindex="screen === 'duplicates' ? -1 : undefined">{{ title }}</h1>
        <p v-if="screen === 'library' && !loading && !libraryError" class="librarySummary">{{ destination.hidden ? 'Hidden images' : librarySummary.images }}</p>
      </div>
      <div class="libraryTools">
        <button v-if="screen === 'library' || screen === 'subject'" type="button" class="shellSecondary" :disabled="applyingTags" aria-label="Filters and search options" @click="filtersDialog?.showModal()"><LibraryIcon name="filter" /><span class="toolLabel">Filters</span></button>
        <button v-if="(screen === 'library' || screen === 'subject') && !selecting" type="button" class="shellPlain selectEntry" @click="selecting = true; bulkNotice = ''">Select</button>
        <LibraryMenu label="More library options">
          <button v-if="(screen === 'library' || screen === 'subject') && !selecting" type="button" :disabled="applyingTags" @click="selecting = true; bulkNotice = ''">Select images</button>
          <button type="button" :disabled="applyingTags" @click="navigation.push({ ...libraryDestination(), hidden: !destination.hidden })">{{ destination.hidden ? 'Show gallery' : 'Hidden images' }}</button>
          <a :href="libraryDestinationUrl(libraryDestination('duplicates'))" :aria-current="screen === 'duplicates' ? 'page' : undefined" :aria-disabled="applyingTags || undefined" @click="linkAction($event, () => navigation.push(libraryDestination('duplicates')))">Review duplicates</a>
          <button type="button" @click="infoDialog?.showModal()">Library information</button>
        </LibraryMenu>
      </div>
    </header>
    <div v-if="galleryFilters.length && (screen === 'library' || screen === 'subject')" class="activeLibraryFilters" aria-label="Active filters">
      <button v-for="tag in galleryFilters" :key="tag.id" type="button" :disabled="applyingTags" :aria-label="`Remove ${tag.name} filter`" @click="removeTagFilter(tag.normalizedName)">{{ tag.name }} ×</button>
      <button type="button" :disabled="applyingTags" @click="clearTagFilters">Clear filters</button>
    </div>
    <p v-if="filterNotice" class="tagsWarning" role="status">{{ filterNotice }}</p>

    <SaveDropzone ref="captureSurface" :expanded="captureOpen" @close="collapseCapture" @open="openCapture()"
      :notice="notice"
      :tags="saving || pageCapture ? batchTags : captureTags"
      :selecting="!!pageCapture"
      :discovering="readingUrl"
      :notice-kind="noticeKind"
      :saving="saving"
      :progress="uploadProgress"
      :result="uploadResult"
      @save="handleSave"
      @retry="retryFailedImages"
      @dismiss="uploadResult = null"
      @save-url="handleSaveUrl"
      @error="showNotice($event, 'error')"
    />

    <PageImageSelection data-page-selection v-if="pageCapture" :page="pageCapture" :tags="batchTags" @close="closePageCapture" @busy="saving = $event" @saved="images = [$event, ...images]; loadTags()" />

    <section v-if="sharedNotice" class="destinationProblem" role="status">
      <p>{{ sharedNotice }}</p>
      <button type="button" @click="sharedNotice = ''">Dismiss</button>
    </section>

    <section v-if="hiddenLinkedImage && !destinationBlocked" class="destinationProblem" role="status">
      <p>This image is hidden from the gallery.</p>
      <button type="button" @click="openHiddenLink">Open hidden image</button>
    </section>

    <section v-if="destinationUnavailable" class="destinationProblem" role="status">
      <p>{{ destinationUnavailable }}</p>
      <button v-if="destination.problem && screen !== 'explore'" type="button" @click="clearAddressRefinements">Open without refinements</button>
      <a href="/?view=explore" @click="linkAction($event, recoverExplore)">Explore subjects</a>
      <a href="/?view=library" @click="linkAction($event, () => navigation.push(libraryDestination()))">Library</a>
    </section>
    <DuplicateReview v-else-if="screen === 'duplicates'" :group-id="destination.referenceId" :broad="destination.reviewMode === 'broad'" :back-href="navigation.similarOriginUrl()"
      @group="id => navigation.replace({ ...destination, referenceId: id })"
      @mode="broad => navigation.replace({ ...destination, referenceId: null, reviewMode: broad ? 'broad' : 'likely' })"
      @back="navigation.returnFromSimilar" :apply-resolution="applyDuplicateResolution" />
    <template v-else-if="screen === 'explore'">
      <section class="rediscovery" aria-labelledby="rediscovery-heading">
        <div class="rediscoveryHeader">
          <div>
            <h2 id="rediscovery-heading" data-rediscovery-heading tabindex="-1">Rediscover</h2>
            <p v-if="!loading && !libraryError && rediscoveredImages.length">{{ rediscovery?.includesRecent ? 'A selection of your saves, including more recent images.' : 'From images you saved at least 30 days ago.' }}</p>
          </div>
          <button v-if="!loading && !libraryError && publicImages.length && (publicImages.length > 1 || !rediscoveredImages.length)" data-rediscovery-refresh type="button" @click="anotherSelection">Another selection</button>
        </div>
        <div v-if="libraryError" class="loadError" role="status">
          <p>Could not load saved images.</p><button type="button" @click="loadImages">Try again</button>
        </div>
        <GalleryGrid v-else :images="rediscoveredImages" :loading="loading" compact :image-href="imageHref"
          :empty-text="publicImages.length ? 'No images remain in this selection. Choose another selection.' : 'Saved images will appear here.'"
          @open="openViewer" @delete="handleDelete" />
      </section>
      <TagExploreGrid hide-search
        v-model:query="exploreQuery" :groups="subjects" :has-tags="allSubjects.length > 0"
        :loading="loading || (tagsLoading && !tagSummaries.length)"
        :error="libraryError || (tagsError && !tagSummaries.length)"
        :dimensions="coverDimensions" :library-href="navigationHref('library')"
        @open="openSubject" @library="showLibrary" @retry="retrySubjects" @dimension="rememberCoverDimensions"
      />
    </template>
    <template v-else-if="screen === 'similar'">
      <div v-if="libraryError" class="loadError" role="status"><p>Could not load the library.</p><button type="button" @click="loadImages">Try again</button></div>
      <SimilarGallery v-else :reference="referenceImage" :images="visibleImages"
        :busy="similarity.current.value.busy || loading" :preparing="similarity.current.value.state === 'preparing'"
        :failed="['failed', 'unavailable'].includes(similarity.current.value.state)" :error="similarity.current.value.error"
        :partial="similarity.current.value.partial" :failed-count="similarity.current.value.failedCount"
        :prepared-count="similarity.current.value.preparedCount" :total-count="similarity.current.value.totalCount"
        :has-more="similarity.current.value.nextOffset !== null" :image-href="imageHref" :back-href="navigation.similarOriginUrl()"
        @open="openViewer" @delete="handleDelete" @more="similarity.more" @retry="retrySimilar" @refresh="refreshSimilar" @back="navigation.returnFromSimilar" />
    </template>
    <template v-else>
      <div v-if="screen === 'subject'" class="subjectContext">
        <a :href="navigationHref('explore')" :aria-disabled="applyingTags || undefined" @click="linkAction($event, showExplore)">Back to Explore</a>
        <button type="button" class="shellPlain" :disabled="applyingTags" @click="searchEntireLibrary">Search entire library</button>
        <p>{{ galleryQuery.trim() || galleryFilters.length ? `${visibleImages.length} of ${subjectImages.length}` : subjectImages.length }} {{ subjectImages.length === 1 ? 'image' : 'images' }}</p>
      </div>
      <p v-if="screen === 'library' && !contentMode && !loading && !libraryError && !destinationBlocked && (galleryQuery.trim() || galleryFilters.length)" class="libraryResultCount" role="status">
        {{ visibleImages.length.toLocaleString('en') }} of {{ librarySummary.images }}
      </p>

      <section v-if="contentMode" class="contentStatus" role="status" aria-live="polite">
        <p>Experimental search by image content. Results may include unrelated images.</p>
        <p v-if="content.current.value.busy && !content.current.value.started">Loading content search.</p>
        <template v-else-if="content.current.value.state === 'inactive' && !content.current.value.error">
          <p>Prepare locally once to search your saved images. The first preparation downloads a model (about 412 MB).</p>
          <button type="button" :disabled="content.current.value.busy || !publicImages.length" @click="content.prepare">Prepare content search</button>
        </template>
        <p v-else-if="content.current.value.state === 'preparing'">Preparing content search. {{ content.current.value.preparedCount }} of {{ content.current.value.totalCount }} images ready. You can keep using the library.</p>
        <template v-else-if="content.current.value.state === 'unavailable' || content.current.value.error">
          <p>{{ content.current.value.error || 'Content search is unavailable. Tags and filename search still works.' }}</p>
          <button type="button" :disabled="content.current.value.busy" @click="content.prepare">Try again</button>
        </template>
        <template v-else-if="content.current.value.state === 'ready'">
          <p v-if="!destination.query.trim()">Describe an image and press Search.</p>
          <p v-else-if="content.current.value.busy">Searching by content.</p>
          <p v-else>Showing up to 24 images for “{{ destination.query }}”.</p>
          <p v-if="content.current.value.failedCount">{{ content.current.value.failedCount }} images could not be prepared. <button type="button" :disabled="content.current.value.busy" @click="content.prepare">Retry preparation</button></p>
          <button v-if="destination.query.trim()" type="button" :disabled="content.current.value.busy" @click="content.refresh">Refresh results</button>
        </template>
      </section>

      <GalleryBulkTags hide-entry
        :selecting="selecting"
        :count="selectedIds.length"
        :busy="applyingTags"
        :notice="bulkNotice"
        :tags="galleryTagSummaries"
        @enter="selecting = true; bulkNotice = ''"
        @exit="exitSelection"
        @select-all="selectedIds = visibleImages.map((image) => image.id)"
        @apply="applyBulkTags"
      />

      <div v-if="resolvingDestination || loading" class="librarySkeleton" role="status" aria-label="Loading library"><span v-for="n in 10" :key="n" :style="{ height: `${180 + (n % 3) * 70}px` }" /><span class="srOnly">Loading library.</span></div>
      <div v-else-if="destinationError" class="loadError" role="status">
        <p>Could not load the requested tags.</p>
        <button type="button" @click="resolveDestinationTags(true)">Try again</button>
      </div>
      <div v-else-if="missingFilters.length" class="destinationProblem" role="status">
        <p>Some filters in this address are no longer available. Remove them to see results.</p>
        <button v-for="id in missingFilters" :key="id" type="button" @click="removeUnavailableFilter(id)">Remove unavailable filter: {{ id }}</button>
      </div>
      <div v-else-if="libraryError" class="loadError" role="status">
        <p>Could not load the library.</p>
        <button type="button" @click="loadImages">Try again</button>
      </div>
      <GalleryGrid v-else-if="!contentMode || (content.current.value.state === 'ready' && destination.query.trim())"
        :images="visibleImages"
        :image-href="imageHref"
        :selecting="selecting"
        :selected-ids="selectedIds"
        :busy="applyingTags"
        @toggle="toggleSelection"
        :loading="loading || contentInitialLoading"
        :empty-text="screen === 'subject' && !subjectImages.length ? 'This subject has no images now. You can return to Explore.' : galleryFilters.length > 0 || galleryQuery.trim() ? 'No images match your search.' : 'No images saved yet.'"
        @open="openViewer"
        @delete="handleDelete"
      />
    </template>

    <p v-if="tagsError && tagSummaries.length" class="tagsWarning" role="status">
      Could not refresh subjects. <button type="button" @click="loadTags">Try again</button>
    </p>

    </div>
    <LightboxViewer
      v-if="selectedImage"
      :image="selectedImage"
      :discovery-busy="viewerDiscovery.busy.value"
      :has-more-discovery="viewerDiscovery.hasMore.value"
      @more-discovery="viewerDiscovery.more"
      :related-images="relatedImages"
      :can-go-back="canGoBack"
      :restoration="viewerRestoration"
      @open-related="openRelatedImage"
      @back="goBackInViewer"
      :has-previous="hasPreviousImage"
      :has-next="hasNextImage"
      :library-tags="galleryTagSummaries"
      :filter-notice="viewerFilterNotice"
      :tags-busy="pendingTagSaves.has(selectedImage.id)"
      :save-tags="saveImageTags"
      :visibility-busy="visibilityBusy.has(selectedImage.id)"
      :visibility-notice="visibilityNotice"
      @visibility="changeVisibility"
      @close="closeViewer"
      @previous="showPreviousImage"
      @next="showNextImage"
      @filter-tag="handleViewerTagFilter"
    />
    </main>
    <nav class="libraryBottom" aria-label="Mobile library navigation">
      <a :href="navigationHref('library')" :aria-current="screen === 'library' || screen === 'similar' ? 'page' : undefined" :aria-disabled="applyingTags || undefined" @click="linkAction($event, showLibrary)"><LibraryIcon name="library" /><span>Library</span></a>
      <a :href="navigationHref('explore')" :aria-current="screen === 'explore' || screen === 'subject' ? 'page' : undefined" :aria-disabled="applyingTags || undefined" @click="linkAction($event, showExplore)"><LibraryIcon name="explore" /><span>Explore</span></a>
      <button type="button" data-add-images :aria-expanded="captureOpen" aria-controls="library-capture" @click="openCapture"><LibraryIcon name="add" /><span aria-live="polite">{{ captureActionLabel }}</span></button>
    </nav>
    <dialog ref="filtersDialog" class="libraryDialog" aria-labelledby="filters-title">
      <div class="dialogHeading"><h2 id="filters-title">Filters and search</h2><button type="button" class="shellIcon" aria-label="Close filters" @click="filtersDialog?.close()">×</button></div>
      <fieldset :disabled="applyingTags" class="filterFieldset">
        <GalleryTagFilters hide-search v-model:query="galleryQuery" :active-filters="galleryFilters" :base-tag="baseTag" :content-search="screen === 'library' && !destination.hidden" :mode="contentMode ? 'content' : 'text'" :tags="galleryTagSummaries" :has-library-tags="hasLibraryTags" :notice="filterNotice" @mode="setSearchMode" @submit="submitContentSearch" @select="addTagFilter" @remove="removeTagFilter" @clear="clearTagFilters" />
      </fieldset>
      <button type="button" class="shellPrimary" @click="filtersDialog?.close()">View images</button>
    </dialog>
    <dialog ref="settingsDialog" class="libraryDialog" aria-labelledby="settings-title">
      <div class="dialogHeading"><h2 id="settings-title">Settings</h2><button type="button" class="shellIcon" aria-label="Close settings" @click="settingsDialog?.close()">×</button></div>
      <LibraryAccessControls />
    </dialog>
    <dialog ref="infoDialog" class="libraryDialog" aria-labelledby="info-title">
      <div class="dialogHeading"><h2 id="info-title">Your library</h2><button type="button" class="shellIcon" aria-label="Close information" @click="infoDialog?.close()">×</button></div>
      <p>{{ librarySummary.images }} · {{ librarySummary.tags }}</p><p>{{ librarySummary.size }} of original image files, including hidden images.</p>
    </dialog>
    <div v-if="dropActive" class="libraryDropOverlay" aria-hidden="true">Drop images to save</div>
  </div>
</template>

<style>
.contentStatus { margin: var(--space-lg) 0; color: var(--color-mute); font-size: 14px; line-height: 1.4; }
.contentStatus p { margin: var(--space-sm) 0; }
.contentStatus button { min-height: 44px; padding: 8px 14px; border: 0; border-radius: var(--radius-md); background: var(--color-secondary-bg); color: var(--color-ink); font-weight: 600; }
.contentStatus button:active { background: var(--color-secondary-pressed); }

.rediscovery { margin: var(--space-xl) 0 64px; }
.rediscoveryHeader { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-md); margin-bottom: var(--space-lg); }
.rediscoveryHeader h2 { margin: 0; font-size: 22px; line-height: 1.25; font-weight: 600; }
.rediscoveryHeader p { margin: 6px 0 0; color: var(--color-mute); font-size: 14px; line-height: 1.4; }
.rediscoveryHeader button { min-height: 44px; padding: 8px 14px; border: 0; border-radius: var(--radius-md); background: var(--color-secondary-bg); color: var(--color-ink); font-size: 14px; font-weight: 700; }
.rediscoveryHeader button:active { background: var(--color-secondary-pressed); }

.filterFieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.subjectContext a, .loadError button, .tagsWarning button { min-height: 44px; min-width: 44px; padding: 8px 14px; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--color-ink); font-size: 14px; font-weight: 700; }
.subjectContext a, .destinationProblem a { display: inline-flex; align-items: center; text-decoration: none; }
.subjectContext a:focus-visible, .destinationProblem a:focus-visible { outline: 2px solid var(--color-focus-outer); outline-offset: 2px; }
.destinationProblem { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm); color: var(--color-mute); font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; margin: var(--space-lg) 0; }
.destinationProblem p { flex-basis: 100%; margin: 0; }
.destinationProblem a, .destinationProblem button { min-height: 44px; min-width: 44px; padding: 8px 14px; border: 0; border-radius: var(--radius-md); color: var(--color-ink); background: var(--color-secondary-bg); font-size: 14px; font-weight: 700; max-width: 100%; overflow-wrap: anywhere; }
.destinationProblem a:active, .destinationProblem button:active { background: var(--color-secondary-pressed); }
.subjectContext { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); flex-wrap: wrap; }
.subjectContext p, .tagsWarning, .loadError { color: var(--color-mute); font-size: 14px; line-height: 1.4; }
.loadError { text-align: center; margin: 48px 0; }

.libraryResultCount { margin: 8px 0; color: var(--color-mute); font-size: 14px; }

.librarySummary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin: 12px 0 0;
  color: var(--color-mute);
  font-size: 14px;
  line-height: 1.4;
}

/* Library shell */
.libraryApp { --shell-rail: 76px; --shell-header: 80px; }
.librarySkip { position: fixed; top: -100px; left: 16px; z-index: 100; padding: 12px; background: white; }
.librarySkip:focus { top: 8px; }
.libraryRail { position: fixed; inset: 0 auto 0 0; z-index: 35; width: var(--shell-rail); padding: 16px 8px; border-right: 1px solid var(--color-hairline); background: var(--color-canvas); display: flex; align-items: center; flex-direction: column; gap: 16px; }
.libraryRail a, .libraryRail button { width: 52px; height: 52px; display: grid; place-items: center; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--color-ink); text-decoration: none; }
.libraryRail .libraryBrand { width: 44px; height: 44px; background: var(--color-primary); color: white; font-size: 24px; font-weight: 700; }
.libraryRail [aria-current] { background: var(--color-surface-card); box-shadow: inset 3px 0 0 var(--color-ink); }
.libraryRail .railSettings { margin-top: auto; }
.libraryHeader { position: sticky; top: 0; z-index: 35; height: var(--shell-header); margin-left: var(--shell-rail); display: flex; align-items: center; gap: 16px; padding: 16px 24px; background: var(--color-canvas); }
.shellPrimary, .shellSecondary, .shellPlain { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 16px; border: 0; border-radius: var(--radius-md); color: var(--color-ink); font-size: 14px; font-weight: 600; }
.shellPrimary { background: var(--color-primary); color: white; }
.shellPrimary:active { background: var(--color-primary-pressed); }
.shellSecondary, .shellPrimary.captureSecondary { background: var(--color-surface-card); color: var(--color-ink); }
.shellPlain { background: transparent; }
.shellIcon { display: inline-grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: var(--radius-full); background: transparent; color: var(--color-ink); font-size: 22px; flex-shrink: 0; }
.shellIcon:hover, .shellPlain:hover, .libraryRail button:hover, .libraryRail a:not(.libraryBrand):hover { background: var(--color-surface-card); }
.headerSettings { display: none; }
.libraryApp .page { width: calc(100% - var(--shell-rail)); max-width: 1328px; margin-left: max(76px, calc((100vw - 1328px + 76px)/2)); padding: 0 24px 32px; }
.libraryApp .topbar { display: flex; align-items: center; justify-content: space-between; min-height: 64px; margin-bottom: 8px; gap: 12px; }
.libraryApp .topbar h1 { margin: 0; font-weight: 700; overflow-wrap: anywhere; font-size: 24px; line-height: 1.2; letter-spacing: -.6px; }
.libraryApp .librarySummary { margin: 5px 0 0; font-size: 12px; }
.libraryTools { display: flex; align-items: center; gap: 8px; }
.activeLibraryFilters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.activeLibraryFilters button { min-height: 44px; padding: 8px 16px; border: 0; border-radius: var(--radius-full); background: var(--color-ink); color: white; font-size: 14px; font-weight: 600; }
.activeLibraryFilters button:last-child { background: transparent; color: var(--color-ink); }
.libraryBottom { display: none; }
.libraryDialog { width: min(520px, calc(100% - 32px)); max-height: calc(100dvh - 32px); overflow: auto; padding: 24px; border: 0; border-radius: var(--radius-lg); color: var(--color-ink); background: var(--color-canvas); }
.libraryDialog::backdrop { background: rgba(38,38,34,.48); }
.dialogHeading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.dialogHeading h2 { margin: 0; font-size: 22px; }
.libraryDialog p { color: var(--color-mute); font-size: 14px; line-height: 1.5; }
.libraryDialog .accessControls { margin: 0; }
.libraryDropOverlay { position: fixed; inset: 12px; z-index: 80; display: grid; place-items: center; pointer-events: none; border: 3px dashed var(--color-ink); border-radius: var(--radius-lg); background: #fffffff0; font-size: 24px; font-weight: 600; }
.librarySkeleton { columns: 5; column-gap: 8px; }
.librarySkeleton > span:not(.srOnly) { display: inline-block; width: 100%; margin-bottom: 8px; border-radius: var(--radius-md); background: var(--color-surface-card); }
.srOnly { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
#library-content, #library-capture, [data-page-selection] { scroll-margin-top: calc(var(--shell-header) + 8px); }
@media (max-width: 1180px) { .librarySkeleton { columns: 4; } }
@media (max-width: 900px) { .librarySkeleton { columns: 3; } }
@media (max-width: 850px) { .toolLabel { display: none; } .libraryTools .shellSecondary { width: 44px; padding: 0; } }
@media (max-width: 640px) {
  .libraryApp { --shell-rail: 0px; --shell-header: 72px; }
  .libraryRail, .headerAdd { display: none; }
  .headerSettings { display: inline-grid; }
  .libraryHeader { padding: 12px 16px; gap: 8px; }
  .libraryApp .page { width: 100%; margin: 0; padding: 0 16px calc(96px + env(safe-area-inset-bottom)); }
  .libraryApp .topbar h1 { margin: 0; font-weight: 700; overflow-wrap: anywhere; font-size: 22px; }
  .selectEntry { display: none; }
  .libraryTools { gap: 4px; }
  .libraryBottom { position: fixed; bottom: 0; left: 0; right: 0; z-index: 35; display: flex; justify-content: space-around; padding: 8px 8px calc(8px + env(safe-area-inset-bottom)); border-top: 1px solid var(--color-hairline); background: var(--color-canvas); }
  .libraryBottom a, .libraryBottom button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-width: 80px; min-height: 52px; padding: 4px 12px; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--color-ink); font-size: 11px; text-decoration: none; }
  .libraryBottom [aria-current] { background: var(--color-surface-card); font-weight: 600; }
  .libraryBottom button { color: var(--color-primary); }
  .librarySkeleton { columns: 2; }
}
@media (max-width: 350px) { .librarySkeleton { columns: 1; } }
</style>
