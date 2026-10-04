<script setup lang="ts">
import { matchesImageSearch } from './utils/image-search'
import { saveImageBatch, type UploadResult } from './utils/image-upload'
import { findRelatedImages } from './utils/related-images'
import { groupImagesByTag } from './utils/tag-exploration'
import { libraryDestination, libraryDestinationUrl, interceptLibraryLink } from './utils/library-navigation'
import { recordViewerVisit, popViewerVisit, type ViewerHistoryEntry, type ViewerPosition } from './utils/viewer-history'
type ImageRecord = {
  id: string
  filename: string
  originalName: string | null
  mimeType: string
  sizeBytes: number
  createdAt: string
  src: string
  tags: ImageTag[]
}

type ImageTag = {
  id: string
  name: string
  normalizedName: string
}

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

const images = ref<ImageRecord[]>([])
const loading = ref(true)
const saving = ref(false)
const uploadProgress = ref<{ current: number; total: number } | null>(null)
const uploadResult = shallowRef<UploadResult | null>(null)
const notice = ref('')
const noticeKind = ref<'success' | 'error'>('success')
const navigation = useLibraryNavigation()
const destination = navigation.destination
const selectedImageId = computed({ get: () => destination.value.imageId, set: (imageId: string | null) => navigation.replace({ ...destination.value, imageId }) })
const returnFocusImageId = ref<string | null>(null)
const viewerHistory = ref<ViewerHistoryEntry[]>([])
const viewerRestoration = ref<(ViewerHistoryEntry & { token: number }) | null>(null)
let viewerTransition = 0
const canGoBack = computed(() => viewerHistory.value.some((entry) => images.value.some((image) => image.id === entry.imageId)))
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
  get: () => destination.value.query,
  set: (query: string) => navigation.replace({ ...destination.value, query }),
})
const exploreQuery = galleryQuery
const galleryFilters = computed(() => destination.value.tagIds.map((id) => tagMetadata.value[id]).filter((tag): tag is ImageTag => Boolean(tag)))
const baseTag = subjectTag
const effectiveFilters = computed(() => baseTag.value ? [baseTag.value, ...galleryFilters.value] : galleryFilters.value)
const requiredTagIds = computed(() => [...(destination.value.subjectId ? [destination.value.subjectId] : []), ...destination.value.tagIds])
const missingFilters = computed(() => destination.value.tagIds.filter((id) => tagLookups.value[id] === 'missing' && !tagMetadata.value[id]))
const resolvingDestination = computed(() => !loading.value && !libraryError.value && requiredTagIds.value.some((id) => !tagMetadata.value[id] && !['missing', 'error'].includes(tagLookups.value[id] ?? 'loading')))
const destinationError = computed(() => requiredTagIds.value.some((id) => !tagMetadata.value[id] && tagLookups.value[id] === 'error'))
const destinationUnavailable = computed(() => destination.value.problem || (destination.value.subjectId && !tagMetadata.value[destination.value.subjectId] && tagLookups.value[destination.value.subjectId] === 'missing' ? 'This subject is no longer available.' : null))
const destinationBlocked = computed(() => Boolean(destinationUnavailable.value || missingFilters.value.length || destinationError.value || resolvingDestination.value))
const title = computed(() => screen.value === 'subject' ? subjectTag.value?.name ?? 'Subject' : screen.value === 'explore' ? 'Explore' : 'Saved visuals')
useHead(() => ({ title: `${title.value} · Visual Library` }))
const navigationHref = (target: 'library' | 'explore') => libraryDestinationUrl(navigation.savedDestination(target))
const imageHref = (id: string) => libraryDestinationUrl({ ...destination.value, imageId: id })
const linkAction = (event: MouseEvent, action: () => void) => { if (interceptLibraryLink(event) && !applyingTags.value) action() }
const subjectImages = computed(() => subjectTag.value ? images.value.filter((image) => image.tags.some((tag) => tag.id === subjectTag.value!.id)) : [])
const allSubjects = computed(() => groupImagesByTag(images.value, tagSummaries.value))
const subjects = computed(() => groupImagesByTag(images.value, tagSummaries.value, exploreQuery.value))
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
    const feedback = message === 'Too many tags' ? 'Some images would exceed 8 tags.'
      : message === 'Tag is too long' ? 'Tag is too long.'
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
  return images.value.filter((image) => {
    const imageTags = new Set(image.tags.map((tag) => tag.normalizedName))
    return !destinationBlocked.value && matchesImageSearch(image, galleryQuery.value)
      && effectiveFilters.value.every((filter) => imageTags.has(filter.normalizedName))
  })
})

const hasLibraryTags = computed(() => tagSummaries.value.length > 0)

const selectedImageIndex = computed(() => {
  if (!selectedImageId.value) {
    return -1
  }

  return visibleImages.value.findIndex((image) => image.id === selectedImageId.value)
})

const selectedImage = computed(() => !loading.value && !destinationBlocked.value ? images.value.find((image) => image.id === selectedImageId.value) ?? null : null)

const relatedImages = computed(() => selectedImage.value ? findRelatedImages(selectedImage.value, images.value) : [])

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
    const loaded = await $fetch<ImageRecord[]>('/api/images')
    const loadedIds = new Set(loaded.map((image) => image.id))
    images.value = [...images.value.filter((image) => !loadedIds.has(image.id)), ...loaded]
    for (const image of images.value) for (const tag of image.tags) tagMetadata.value[tag.id] = tag
    await loadTags()
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

const handleSave = async (files: File[], retry = false) => {
  if (saving.value || !files.length) return
  const previous = retry ? uploadResult.value ?? undefined : undefined
  saving.value = true
  clearCaptureNotice()
  uploadResult.value = null
  try {
    uploadResult.value = await saveImageBatch(files, async (file) => {
      const formData = new FormData()
      formData.append('image', file)
      const saved = await $fetch<SaveImageResponse>('/api/images', { method: 'POST', body: formData })
      if (isDuplicateSaveResponse(saved)) return 'duplicate'
      images.value = [saved, ...images.value]
      return 'saved'
    }, (current, total) => { uploadProgress.value = { current, total } }, previous)
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
  if (saving.value) return
  saving.value = true
  uploadResult.value = null
  clearCaptureNotice()
  try {
    const saved = await $fetch<SaveImageResponse>('/api/images', { method: 'POST', body: { url } })
    applySaveResponse(saved)
  } catch (error) {
    const message = (error as { data?: { statusMessage?: string } }).data?.statusMessage
    showNotice(message || 'This image URL cannot be saved.', 'error')
  } finally {
    saving.value = false
  }
}

const handleDelete = async (id: string) => {
  try {
    await $fetch(`/api/images/${id}`, { method: 'DELETE' })
    images.value = images.value.filter((image) => image.id !== id)
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
  const fallback = screen.value === 'explore' ? '[data-explore-search]' : '[data-library-search]'
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
watch([() => navigation.entry.value?.key, loading, destinationBlocked], async ([key]) => {
  if (!key) return
  if (key !== interactionKey) {
    closingFocusId = destination.value.imageId ? null : returnFocusImageId.value
    resetPageInteraction()
    interactionKey = key
    restoredKey = null
    if (destination.value.imageId) returnFocusImageId.value = navigation.entry.value?.parent?.focusId ?? destination.value.imageId
  }
  if (loading.value || destinationBlocked.value || libraryError.value || restoredKey === key || destination.value.imageId) return
  restoredKey = key
  const state = navigation.entry.value!
  if (closingFocusId) {
    const selector = `[data-lightbox-open-id="${CSS.escape(closingFocusId)}"]`
    closingFocusId = null
    void restorePage(state, selector, pageTransition)
    return
  }
  if (navigation.mode.value === 'push' && screen.value === 'subject') {
    await nextTick()
    if (navigation.entry.value?.key !== key) return
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector<HTMLElement>('[data-subject-heading]')?.focus({ preventScroll: true })
  } else if (!destination.value.imageId) {
    const selector = state.focusId ? `[${screen.value === 'explore' ? 'data-explore-tag-id' : 'data-lightbox-open-id'}="${CSS.escape(state.focusId)}"]` : screen.value === 'explore' ? '[data-explore-search]' : '[data-library-search]'
    void restorePage(state, selector, pageTransition)
  }
})
watch([selectedImage, loading, destinationBlocked], () => {
  if (loading.value || destinationBlocked.value || libraryError.value) return
  if (selectedImage.value) navigation.ensureViewerParent()
  else if (destination.value.imageId) {
    navigation.replace({ ...destination.value, imageId: null })
    showNotice('This image is no longer in the library.', 'error')
  }
})

const retrySubjects = () => { if (libraryError.value) void loadImages(); else void loadTags() }
const rememberCoverDimensions = (id: string, width: number, height: number) => {
  if (width && height) coverDimensions.value[id] = { width, height }
}

const openViewer = (id: string) => {
  cancelPageRestoration()
  viewerHistory.value = []
  viewerRestoration.value = null
  viewerTransition += 1
  returnFocusImageId.value = id
  navigation.push({ ...destination.value, imageId: id }, id)
}

const closeViewer = () => navigation.closeViewer()

const navigateViewer = (id: string | undefined, position: ViewerPosition, related = false) => {
  if (!id || !selectedImageId.value || !images.value.some((image) => image.id === id) || id === selectedImageId.value) return
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
  const { entry, history } = popViewerVisit(viewerHistory.value, new Set(images.value.map((image) => image.id)))
  viewerHistory.value = history
  if (!entry) return false
  viewerRestoration.value = { ...entry, token: ++viewerTransition }
  selectedImageId.value = entry.imageId
  return true
}

onMounted(() => {
  navigation.start()
  void loadImages()
})

onBeforeUnmount(() => {
  navigation.stop()
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
  <main class="page" @keydown.esc="selecting && exitSelection()">
    <header class="topbar">
      <div>
        <p class="eyebrow">Visual Library</p>
        <h1 v-if="screen === 'subject'" data-subject-heading tabindex="-1">{{ title }}</h1>
        <h1 v-else>{{ screen === 'explore' ? 'Explore' : 'Saved visuals' }}</h1>
      </div>
    </header>

    <nav class="libraryNav" aria-label="Library navigation">
      <a :href="navigationHref('explore')" :aria-current="screen !== 'library' ? 'page' : undefined" :aria-disabled="applyingTags || undefined" @click="linkAction($event, showExplore)">Explore</a>
      <a :href="navigationHref('library')" :aria-current="screen === 'library' ? 'page' : undefined" :aria-disabled="applyingTags || undefined" @click="linkAction($event, showLibrary)">Library</a>
    </nav>

    <SaveDropzone
      :notice="notice"
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

    <section v-if="destinationUnavailable" class="destinationProblem" role="status">
      <p>{{ destinationUnavailable }}</p>
      <button v-if="destination.problem && screen !== 'explore'" type="button" @click="clearAddressRefinements">Open without refinements</button>
      <a href="/?view=explore" @click="linkAction($event, recoverExplore)">Explore subjects</a>
      <a href="/" @click="linkAction($event, () => navigation.push(libraryDestination()))">Library</a>
    </section>
    <TagExploreGrid
      v-else-if="screen === 'explore'"
      v-model:query="exploreQuery" :groups="subjects" :has-tags="allSubjects.length > 0"
      :loading="loading || (tagsLoading && !tagSummaries.length)"
      :error="libraryError || (tagsError && !tagSummaries.length)"
      :dimensions="coverDimensions" :library-href="navigationHref('library')"
      @open="openSubject" @library="showLibrary" @retry="retrySubjects" @dimension="rememberCoverDimensions"
    />
    <template v-else>
      <div v-if="screen === 'subject'" class="subjectContext">
        <a :href="navigationHref('explore')" :aria-disabled="applyingTags || undefined" @click="linkAction($event, showExplore)">Back to Explore</a>
        <p>{{ galleryQuery.trim() || galleryFilters.length ? `${visibleImages.length} of ${subjectImages.length}` : subjectImages.length }} {{ subjectImages.length === 1 ? 'image' : 'images' }}</p>
      </div>
      <fieldset :disabled="applyingTags" :inert="applyingTags" class="filterFieldset">
        <GalleryTagFilters
          v-model:query="galleryQuery"
          :active-filters="galleryFilters"
          :base-tag="baseTag"
          :tags="tagSummaries"
          :has-library-tags="hasLibraryTags"
          :notice="filterNotice"
          @select="addTagFilter"
          @remove="removeTagFilter"
          @clear="clearTagFilters"
        />

      </fieldset>

      <GalleryBulkTags
        :selecting="selecting"
        :count="selectedIds.length"
        :busy="applyingTags"
        :notice="bulkNotice"
        :tags="tagSummaries"
        @enter="selecting = true; bulkNotice = ''"
        @exit="exitSelection"
        @select-all="selectedIds = visibleImages.map((image) => image.id)"
        @apply="applyBulkTags"
      />

      <div v-if="resolvingDestination || loading" class="loadError" role="status">Loading {{ screen === 'subject' ? 'subject' : 'library' }}.</div>
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
      <GalleryGrid v-else
        :images="visibleImages"
        :image-href="imageHref"
        :selecting="selecting"
        :selected-ids="selectedIds"
        :busy="applyingTags"
        @toggle="toggleSelection"
        :loading="loading"
        :empty-text="screen === 'subject' && !subjectImages.length ? 'This subject has no images now. You can return to Explore.' : galleryFilters.length > 0 || galleryQuery.trim() ? 'No images match your search.' : 'No images saved yet.'"
        @open="openViewer"
        @delete="handleDelete"
      />
    </template>

    <p v-if="tagsError && tagSummaries.length" class="tagsWarning" role="status">
      Could not refresh subjects. <button type="button" @click="loadTags">Try again</button>
    </p>

    <LightboxViewer
      v-if="selectedImage"
      :image="selectedImage"
      :related-images="relatedImages"
      :can-go-back="canGoBack"
      :restoration="viewerRestoration"
      @open-related="openRelatedImage"
      @back="goBackInViewer"
      :has-previous="hasPreviousImage"
      :has-next="hasNextImage"
      :library-tags="tagSummaries"
      :filter-notice="viewerFilterNotice"
      :tags-busy="pendingTagSaves.has(selectedImage.id)"
      :save-tags="saveImageTags"
      @close="closeViewer"
      @previous="showPreviousImage"
      @next="showNextImage"
      @filter-tag="handleViewerTagFilter"
    />
  </main>
</template>

<style>
.filterFieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.libraryNav { display: flex; gap: var(--space-sm); margin-bottom: var(--space-lg); }
.libraryNav a, .subjectContext a, .loadError button, .tagsWarning button { min-height: 44px; min-width: 44px; padding: 8px 14px; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--color-ink); font-size: 14px; font-weight: 700; }
.libraryNav a { position: relative; }
.libraryNav a, .subjectContext a, .destinationProblem a { display: inline-flex; align-items: center; text-decoration: none; }
.libraryNav a:focus-visible, .subjectContext a:focus-visible, .destinationProblem a:focus-visible { outline: 2px solid var(--color-focus-outer); outline-offset: 2px; }
.destinationProblem { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm); color: var(--color-mute); font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; margin: var(--space-lg) 0; }
.destinationProblem p { flex-basis: 100%; margin: 0; }
.destinationProblem a, .destinationProblem button { min-height: 44px; min-width: 44px; padding: 8px 14px; border: 0; border-radius: var(--radius-md); color: var(--color-ink); background: var(--color-secondary-bg); font-size: 14px; font-weight: 700; max-width: 100%; overflow-wrap: anywhere; }
.destinationProblem a:active, .destinationProblem button:active { background: var(--color-secondary-pressed); }
.libraryNav a[aria-current] { background: var(--color-surface-card); }
.libraryNav a[aria-current]::after { content: ""; position: absolute; bottom: 0; left: 12px; right: 12px; height: 2px; background: var(--color-primary); }
.libraryNav a:active, .subjectContext a:active, .loadError button:active, .tagsWarning button:active { background: var(--color-secondary-pressed); }
.libraryNav a[aria-disabled], .subjectContext a[aria-disabled] { color: var(--color-ash); cursor: default; }
.subjectContext { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); flex-wrap: wrap; }
.subjectContext p, .tagsWarning, .loadError { color: var(--color-mute); font-size: 14px; line-height: 1.4; }
.loadError { text-align: center; margin: 48px 0; }
.page {
  width: min(100%, 1280px);
  margin: 0 auto;
  padding: 24px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--color-mute);
  font-size: 14px;
  font-weight: 600;
}

h1 {
  margin: 0;
  color: var(--color-ink);
  font-size: clamp(32px, 5vw, 54px);
  font-weight: 700;
  letter-spacing: -0.8px;
  line-height: 1.05;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .page {
    padding: 16px;
  }
}
</style>
