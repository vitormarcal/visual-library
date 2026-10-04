<script setup lang="ts">
import { matchesImageSearch } from './utils/image-search'
import { saveImageBatch, type UploadResult } from './utils/image-upload'
import { findRelatedImages } from './utils/related-images'
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
const selectedImageId = ref<string | null>(null)
const returnFocusImageId = ref<string | null>(null)
const viewerHistory = ref<ViewerHistoryEntry[]>([])
const viewerRestoration = ref<(ViewerHistoryEntry & { token: number }) | null>(null)
let viewerTransition = 0
const canGoBack = computed(() => viewerHistory.value.some((entry) => images.value.some((image) => image.id === entry.imageId)))
const tagSummaries = ref<TagSummary[]>([])
const pendingTagSaves = ref(new Set<string>())
const activeTagFilters = ref<ImageTag[]>([])
const searchQuery = ref('')
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
  applyingTags.value = true
  bulkNotice.value = ''
  try {
    const response = await $fetch<{ images: { id: string; tags: ImageTag[] }[] }>('/api/images/tags', {
      method: 'POST', body: { imageIds: [...selectedIds.value], tags },
    })
    const updated = new Map(response.images.map((image) => [image.id, image.tags]))
    images.value = images.value.map((image) => updated.has(image.id) ? { ...image, tags: updated.get(image.id)! } : image)
    selectedIds.value = []
    bulkNotice.value = 'Tags added.'
    await loadTags()
  } catch (error) {
    const message = (error as { data?: { statusMessage?: string } }).data?.statusMessage
    bulkNotice.value = message === 'Too many tags' ? 'Some images would exceed 8 tags.'
      : message === 'Tag is too long' ? 'Tag is too long.'
        : message === 'Image not found' ? 'An image no longer exists. Refresh the library and try again.'
          : 'Could not add tags. Try again.'
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
    return matchesImageSearch(image, searchQuery.value)
      && activeTagFilters.value.every((filter) => imageTags.has(filter.normalizedName))
  })
})

const hasLibraryTags = computed(() => tagSummaries.value.length > 0)

const selectedImageIndex = computed(() => {
  if (!selectedImageId.value) {
    return -1
  }

  return visibleImages.value.findIndex((image) => image.id === selectedImageId.value)
})

const selectedImage = computed(() => images.value.find((image) => image.id === selectedImageId.value) ?? null)

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
  try {
    tagSummaries.value = await $fetch<TagSummary[]>('/api/tags')
  } catch {
    tagSummaries.value = []
  }
}

const loadImages = async () => {
  loading.value = true

  try {
    const loaded = await $fetch<ImageRecord[]>('/api/images')
    const loadedIds = new Set(loaded.map((image) => image.id))
    images.value = [...images.value.filter((image) => !loadedIds.has(image.id)), ...loaded]
    await loadTags()
  } catch {
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
    activeTagFilters.value = activeTagFilters.value.filter((filter) => {
      return images.value.some((image) => image.tags.some((tag) => tag.normalizedName === filter.normalizedName))
    })
    void loadTags()
  } catch {
    showNotice('Could not remove this image.', 'error')
  }
}

const addTagFilter = (tag: ImageTag) => {
  if (activeTagFilters.value.some((filter) => filter.normalizedName === tag.normalizedName)) {
    return true
  }

  if (activeTagFilters.value.length >= 3) {
    showFilterNotice('Too many filters')
    return false
  }

  activeTagFilters.value = [...activeTagFilters.value, tag]
  return true
}

const removeTagFilter = (normalizedName: string) => {
  activeTagFilters.value = activeTagFilters.value.filter((filter) => filter.normalizedName !== normalizedName)
}

const clearTagFilters = () => {
  searchQuery.value = ''
  activeTagFilters.value = []
}

const handleViewerTagFilter = (tag: ImageTag) => {
  if (addTagFilter(tag)) {
    viewerFilterNotice.value = ''
    closeViewer()
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

const focusGalleryTile = async (id: string | null) => {
  await nextTick()
  const element = id ? document.querySelector<HTMLElement>(`[data-lightbox-open-id="${id}"]`) : null
  ;(element ?? document.querySelector<HTMLInputElement>('[data-library-search]'))?.focus({ preventScroll: true })
}

const openViewer = (id: string) => {
  viewerHistory.value = []
  viewerRestoration.value = null
  viewerTransition += 1
  selectedImageId.value = id
  returnFocusImageId.value = id
}

const closeViewer = () => {
  const focusId = returnFocusImageId.value
  selectedImageId.value = null
  returnFocusImageId.value = null
  viewerHistory.value = []
  viewerRestoration.value = null
  viewerTransition += 1
  void focusGalleryTile(focusId)
}

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
  void loadImages()
})

onBeforeUnmount(() => {
  if (uploadResultTimer) clearTimeout(uploadResultTimer)
  if (noticeTimer) clearTimeout(noticeTimer)
  if (filterNoticeTimer) clearTimeout(filterNoticeTimer)
  if (viewerFilterNoticeTimer) clearTimeout(viewerFilterNoticeTimer)
})

watch(visibleImages, () => {
  const visibleIds = new Set(visibleImages.value.map((image) => image.id))
  selectedIds.value = selectedIds.value.filter((id) => visibleIds.has(id))
})

watch(images, () => {
  if (selectedImageId.value && !images.value.some((image) => image.id === selectedImageId.value)) {
    if (!goBackInViewer()) closeViewer()
    showNotice('This image is no longer in the library.', 'error')
  }
}, { flush: 'sync' })
</script>

<template>
  <main class="page" @keydown.esc="selecting && exitSelection()">
    <header class="topbar">
      <div>
        <p class="eyebrow">Visual Library</p>
        <h1>Saved visuals</h1>
      </div>
    </header>

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

    <fieldset :disabled="applyingTags" :inert="applyingTags" class="filterFieldset">
      <GalleryTagFilters
        v-model:query="searchQuery"
        :active-filters="activeTagFilters"
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

    <GalleryGrid
      :images="visibleImages"
      :selecting="selecting"
      :selected-ids="selectedIds"
      :busy="applyingTags"
      @toggle="toggleSelection"
      :loading="loading"
      :empty-text="activeTagFilters.length > 0 || searchQuery.trim() ? 'No images match your search.' : 'No images saved yet.'"
      @open="openViewer"
      @delete="handleDelete"
    />

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
}

@media (max-width: 640px) {
  .page {
    padding: 16px;
  }
}
</style>
