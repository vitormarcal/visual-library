<script setup lang="ts">
type ImageRecord = {
  id: string
  filename: string
  originalName: string | null
  mimeType: string
  sizeBytes: number
  createdAt: string
  src: string
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
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const selectedImageIndex = computed(() => {
  if (!selectedImageId.value) {
    return -1
  }

  return images.value.findIndex((image) => image.id === selectedImageId.value)
})

const selectedImage = computed(() => {
  if (selectedImageIndex.value === -1) {
    return null
  }

  return images.value[selectedImageIndex.value]
})

const hasPreviousImage = computed(() => selectedImageIndex.value > 0)
const hasNextImage = computed(() => selectedImageIndex.value >= 0 && selectedImageIndex.value < images.value.length - 1)

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

const loadImages = async () => {
  loading.value = true

  try {
    images.value = await $fetch<ImageRecord[]>('/api/images')
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

    if (selectedImageId.value === id) {
      selectedImageId.value = null
    }
  } catch {
    showNotice('Could not remove this image.', 'error')
  }
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

  selectedImageId.value = images.value[selectedImageIndex.value - 1]?.id ?? selectedImageId.value
}

const showNextImage = () => {
  if (!hasNextImage.value) {
    return
  }

  selectedImageId.value = images.value[selectedImageIndex.value + 1]?.id ?? selectedImageId.value
}

onMounted(() => {
  void loadImages()
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

    <GalleryGrid
      :images="images"
      :loading="loading"
      @open="openViewer"
      @delete="handleDelete"
    />

    <LightboxViewer
      v-if="selectedImage"
      :image="selectedImage"
      :has-previous="hasPreviousImage"
      :has-next="hasNextImage"
      @close="closeViewer"
      @previous="showPreviousImage"
      @next="showNextImage"
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
