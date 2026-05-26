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

const images = ref<ImageRecord[]>([])
const loading = ref(true)
const notice = ref('')
const noticeKind = ref<'success' | 'error'>('success')
let noticeTimer: ReturnType<typeof setTimeout> | undefined

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

  try {
    const saved = await $fetch<ImageRecord>('/api/images', {
      method: 'POST',
      body: formData,
    })

    images.value = [saved, ...images.value]
    showNotice('Saved.', 'success')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save this image.'
    showNotice(message, 'error')
  }
}

const handleDelete = async (id: string) => {
  try {
    await $fetch(`/api/images/${id}`, { method: 'DELETE' })
    images.value = images.value.filter((image) => image.id !== id)
  } catch {
    showNotice('Could not remove this image.', 'error')
  }
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
      @save="handleSave"
      @error="showNotice($event, 'error')"
    />

    <GalleryGrid
      :images="images"
      :loading="loading"
      @delete="handleDelete"
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
