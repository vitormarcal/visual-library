<script setup lang="ts">
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
const notice = ref('')
const noticeKind = ref<'success' | 'error'>('success')
const selectedImageId = ref<string | null>(null)
const returnFocusImageId = ref<string | null>(null)
const tagSummaries = ref<TagSummary[]>([])
const activeTagFilters = ref<ImageTag[]>([])
const filterNotice = ref('')
const viewerFilterNotice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let filterNoticeTimer: ReturnType<typeof setTimeout> | undefined
let viewerFilterNoticeTimer: ReturnType<typeof setTimeout> | undefined

const visibleImages = computed(() => {
  if (activeTagFilters.value.length === 0) {
    return images.value
  }

  return images.value.filter((image) => {
    const imageTags = new Set(image.tags.map((tag) => tag.normalizedName))
    return activeTagFilters.value.every((filter) => imageTags.has(filter.normalizedName))
  })
})

const hasLibraryTags = computed(() => tagSummaries.value.length > 0)

const selectedImageIndex = computed(() => {
  if (!selectedImageId.value) {
    return -1
  }

  return visibleImages.value.findIndex((image) => image.id === selectedImageId.value)
})

const selectedImage = computed(() => {
  if (selectedImageIndex.value === -1) {
    return null
  }

  return visibleImages.value[selectedImageIndex.value]
})

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
    images.value = await $fetch<ImageRecord[]>('/api/images')
    await loadTags()
  } catch {
    showNotice('Could not load the library.', 'error')
  } finally {
    loading.value = false
  }
}

const handleSave = async (file: File) => {
  const formData = new FormData()
  formData.append('image', file)
  saving.value = true

  try {
    const saved = await $fetch<SaveImageResponse>('/api/images', {
      method: 'POST',
      body: formData,
    })

    applySaveResponse(saved)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save this image.'
    showNotice(message, 'error')
  } finally {
    saving.value = false
  }
}

const handleSaveUrl = async (url: string) => {
  saving.value = true

  try {
    const saved = await $fetch<SaveImageResponse>('/api/images', {
      method: 'POST',
      body: { url },
    })

    applySaveResponse(saved)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'This image URL cannot be saved.'
    showNotice(message, 'error')
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

    if (selectedImageId.value === id) {
      selectedImageId.value = null
    }
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
  activeTagFilters.value = []
}

const handleViewerTagFilter = (tag: ImageTag) => {
  if (addTagFilter(tag)) {
    viewerFilterNotice.value = ''
    selectedImageId.value = null
    returnFocusImageId.value = null
  } else {
    showViewerFilterNotice('Too many filters')
  }
}

const handleImageTagsUpdated = (id: string, tags: ImageTag[]) => {
  images.value = images.value.map((image) => image.id === id ? { ...image, tags } : image)
  activeTagFilters.value = activeTagFilters.value.filter((filter) => {
    return images.value.some((image) => image.tags.some((tag) => tag.normalizedName === filter.normalizedName))
  })
  void loadTags()
}

const focusGalleryTile = async (id: string | null) => {
  if (!id) {
    return
  }

  await nextTick()
  const element = document.querySelector<HTMLElement>(`[data-lightbox-open-id="${id}"]`)
  element?.focus()
}

const openViewer = (id: string) => {
  selectedImageId.value = id
  returnFocusImageId.value = id
}

const closeViewer = () => {
  const focusId = returnFocusImageId.value
  selectedImageId.value = null
  returnFocusImageId.value = null
  void focusGalleryTile(focusId)
}

const showPreviousImage = () => {
  if (!hasPreviousImage.value) {
    return
  }

  selectedImageId.value = visibleImages.value[selectedImageIndex.value - 1]?.id ?? selectedImageId.value
}

const showNextImage = () => {
  if (!hasNextImage.value) {
    return
  }

  selectedImageId.value = visibleImages.value[selectedImageIndex.value + 1]?.id ?? selectedImageId.value
}

onMounted(() => {
  void loadImages()
})

watch(visibleImages, () => {
  if (selectedImageId.value && !visibleImages.value.some((image) => image.id === selectedImageId.value)) {
    selectedImageId.value = null
    returnFocusImageId.value = null
  }
})
</script>

<template>
  <main class="page">
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
      @save="handleSave"
      @save-url="handleSaveUrl"
      @error="showNotice($event, 'error')"
    />

    <GalleryTagFilters
      :active-filters="activeTagFilters"
      :tags="tagSummaries"
      :has-library-tags="hasLibraryTags"
      :notice="filterNotice"
      @select="addTagFilter"
      @remove="removeTagFilter"
      @clear="clearTagFilters"
    />

    <GalleryGrid
      :images="visibleImages"
      :loading="loading"
      :empty-text="activeTagFilters.length > 0 ? 'No images match these tags.' : 'No images saved yet.'"
      @open="openViewer"
      @delete="handleDelete"
    />

    <LightboxViewer
      v-if="selectedImage"
      :image="selectedImage"
      :has-previous="hasPreviousImage"
      :has-next="hasNextImage"
      :library-tags="tagSummaries"
      :filter-notice="viewerFilterNotice"
      @close="closeViewer"
      @previous="showPreviousImage"
      @next="showNextImage"
      @filter-tag="handleViewerTagFilter"
      @tags-updated="handleImageTagsUpdated"
    />
  </main>
</template>

<style>
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
