<script setup lang="ts">
import styles from './SaveDropzone.module.css'

defineProps<{
  notice: string
  noticeKind: 'success' | 'error'
}>()

const emit = defineEmits<{
  save: [file: File]
  error: [message: string]
}>()

const inputId = 'image-upload'
const dropzone = ref<HTMLElement | null>(null)
const dragging = ref(false)
let dragDepth = 0

const imageExtensions = ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']
const imageMimeTypes = ['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']
const acceptTypes = [...imageMimeTypes, ...imageExtensions].join(',')

const isImageFile = (file: File) => {
  if (imageMimeTypes.includes(file.type)) {
    return true
  }

  const name = file.name.toLowerCase()
  return imageExtensions.some((extension) => name.endsWith(extension))
}

const firstImageFile = (files: FileList | File[]) => {
  return Array.from(files).find(isImageFile)
}

const filesFromTransfer = (transfer: DataTransfer | null) => {
  if (!transfer) {
    return []
  }

  const transferFiles = Array.from(transfer.files ?? [])
  const itemFiles = Array.from(transfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))

  return [...transferFiles, ...itemFiles]
}

const preferredFile = (files: FileList | File[]) => {
  const fileList = Array.from(files)
  return firstImageFile(fileList) ?? fileList[0]
}

const submitFile = (file: File | undefined) => {
  if (!file) {
    emit('error', 'Drop a local image file or use Choose image.')
    return
  }

  emit('save', file)
}

const prepareDragEvent = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

const handleDragEnter = (event: DragEvent) => {
  prepareDragEvent(event)
  dragDepth += 1
  dragging.value = true
}

const handleDragOver = (event: DragEvent) => {
  prepareDragEvent(event)
  dragging.value = true
}

const handleDragLeave = (event: DragEvent) => {
  prepareDragEvent(event)
  dragDepth = Math.max(0, dragDepth - 1)

  if (dragDepth === 0) {
    dragging.value = false
  }
}

const handleDrop = (event: DragEvent) => {
  prepareDragEvent(event)
  dragDepth = 0
  dragging.value = false
  submitFile(preferredFile(filesFromTransfer(event.dataTransfer)))
}

const handlePaste = (event: ClipboardEvent) => {
  submitFile(event.clipboardData?.files ? preferredFile(event.clipboardData.files) : undefined)
}

const handleInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  submitFile(input.files ? preferredFile(input.files) : undefined)
  input.value = ''
}

onMounted(() => {
  const element = dropzone.value

  if (!element) {
    return
  }

  element.addEventListener('dragenter', handleDragEnter, { capture: true })
  element.addEventListener('dragover', handleDragOver, { capture: true })
  element.addEventListener('dragleave', handleDragLeave, { capture: true })
  element.addEventListener('drop', handleDrop, { capture: true })
})

onBeforeUnmount(() => {
  const element = dropzone.value

  if (!element) {
    return
  }

  element.removeEventListener('dragenter', handleDragEnter, { capture: true })
  element.removeEventListener('dragover', handleDragOver, { capture: true })
  element.removeEventListener('dragleave', handleDragLeave, { capture: true })
  element.removeEventListener('drop', handleDrop, { capture: true })
})
</script>

<template>
  <section
    ref="dropzone"
    :class="[styles.dropzone, dragging && styles.dragging]"
    tabindex="0"
    aria-label="Drop, paste, or upload an image"
    @paste="handlePaste"
  >
    <div :class="styles.copy">
      <strong>Drop or paste an image</strong>
      <span>Local files only</span>
    </div>

    <label :class="styles.uploadButton" :for="inputId">
      Choose image
    </label>
    <input
      :id="inputId"
      :class="styles.fileInput"
      type="file"
      :accept="acceptTypes"
      @change="handleInput"
    >

    <p
      v-if="notice"
      :class="[styles.notice, noticeKind === 'error' ? styles.error : styles.success]"
      role="status"
      aria-live="polite"
    >
      {{ notice }}
    </p>
  </section>
</template>
