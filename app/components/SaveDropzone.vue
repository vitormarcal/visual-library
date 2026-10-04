<script setup lang="ts">
import styles from './SaveDropzone.module.css'
import { acceptImageTypes, filesFromTransfer, isImageFile, uploadSummary, type UploadResult } from '../utils/image-upload'

const props = defineProps<{
  notice: string
  noticeKind: 'success' | 'error'
  saving: boolean
  progress: { current: number; total: number } | null
  result: UploadResult | null
}>()

const emit = defineEmits<{
  save: [files: File[]]
  saveUrl: [url: string]
  error: [message: string]
  retry: []
  dismiss: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const pickerButton = ref<HTMLButtonElement | null>(null)
const failureDetails = ref<HTMLDetailsElement | null>(null)
const dragging = ref(false)
const busyAttempt = ref(false)
let dragDepth = 0
let returnFocusToPicker = false
const hasRetryableFailures = computed(() => props.result?.failures.some((failure) => failure.retryable) ?? false)
const statusText = computed(() => {
  if (props.saving) {
    const progress = props.progress
    const message = progress && progress.total > 1 ? `Saving ${progress.current} of ${progress.total}…` : 'Saving image…'
    return busyAttempt.value ? `${message} Please wait before adding more images.` : message
  }
  if (props.result) return uploadSummary(props.result)
  if (props.notice) return props.notice
  return 'Paste an image or image URL, drop files, or choose images'
})

const captureBusy = () => {
  if (!props.saving) return false
  busyAttempt.value = true
  return true
}
const submitFiles = (files: File[]) => {
  if (captureBusy()) return
  if (!files.length) { emit('error', 'Drop local image files or use Choose images.'); return }
  emit('save', files)
}
const prepareDragEvent = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = props.saving ? 'none' : 'copy'
}
const handleDragEnter = (event: DragEvent) => {
  prepareDragEvent(event)
  dragDepth += 1
  dragging.value = !props.saving
}
const handleDragOver = (event: DragEvent) => {
  prepareDragEvent(event)
  dragging.value = !props.saving
}
const handleDragLeave = (event: DragEvent) => {
  prepareDragEvent(event)
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) dragging.value = false
}
const handleDrop = (event: DragEvent) => {
  prepareDragEvent(event)
  dragDepth = 0
  dragging.value = false
  submitFiles(filesFromTransfer(event.dataTransfer))
}
const looksLikeUrl = (value: string) => {
  if (!value || /\s/.test(value)) return false
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:' }
  catch { return false }
}
const handlePaste = (event: ClipboardEvent) => {
  const file = Array.from(event.clipboardData?.files ?? []).find(isImageFile)
  const text = event.clipboardData?.getData('text/plain')?.trim() ?? ''
  if (!file && !looksLikeUrl(text)) return
  event.preventDefault()
  if (captureBusy()) return
  if (file) emit('save', [file])
  else emit('saveUrl', text)
}
const handleInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) submitFiles(files)
}
const dismiss = () => {
  emit('dismiss')
  pickerButton.value?.focus({ preventScroll: true })
}
const retry = async () => {
  if (props.saving) return
  returnFocusToPicker = true
  emit('retry')
  await nextTick()
  // The retry control disappears during saving; the focusable capture surface remains.
  captureSurface.value?.focus({ preventScroll: true })
}
const captureSurface = ref<HTMLElement | null>(null)
watch(() => props.saving, async (saving) => {
  busyAttempt.value = false
  if (saving && document.activeElement === pickerButton.value) {
    returnFocusToPicker = true
    captureSurface.value?.focus({ preventScroll: true })
  }
  if (!saving) {
    const restoreFocus = returnFocusToPicker
    returnFocusToPicker = false
    await nextTick()
    if (restoreFocus && document.activeElement === captureSurface.value) pickerButton.value?.focus({ preventScroll: true })
  }
})
watch(() => props.result, (result) => {
  if (failureDetails.value && result) failureDetails.value.open = false
})
</script>

<template>
  <section
    ref="captureSurface"
    :class="[styles.dropzone, dragging && styles.dragging]"
    tabindex="0"
    aria-label="Drop, paste, or upload images"
    @paste="handlePaste"
    @dragenter.capture="handleDragEnter"
    @dragover.capture="handleDragOver"
    @dragleave.capture="handleDragLeave"
    @drop.capture="handleDrop"
  >
    <div :class="styles.copy">
      <strong>Save images</strong>
      <span
        :class="[styles.status, !saving && (result || notice) && styles.result, !saving && !result && notice && noticeKind === 'error' && styles.error]"
        role="status" aria-live="polite" aria-atomic="true"
      >{{ statusText }}<span v-if="notice && (saving || result)" :class="noticeKind === 'error' && styles.error"> {{ notice }}</span></span>
    </div>
    <button
      ref="pickerButton" :class="styles.uploadButton" type="button"
      :disabled="saving" @click="fileInput?.click()"
    >Choose images</button>
    <input
      ref="fileInput" :class="styles.fileInput" type="file" multiple
      :accept="acceptImageTypes" :disabled="saving" tabindex="-1" aria-hidden="true"
      @change="handleInput"
    >
  </section>

  <section v-if="result?.failures.length && !saving" :class="styles.feedback" aria-label="Save failures">
    <div :class="styles.actions">
      <button v-if="hasRetryableFailures" :class="styles.secondary" type="button" @click="retry">Retry failed</button>
      <button :class="styles.tertiary" type="button" @click="dismiss">Dismiss</button>
    </div>
    <details ref="failureDetails" :class="styles.failures">
      <summary :class="styles.tertiary">View {{ result.failures.length }} {{ result.failures.length === 1 ? 'failure' : 'failures' }}</summary>
      <ul :class="styles.failureList">
        <li v-for="(failure, index) in result.failures" :key="index">
          <span :class="styles.filename">{{ failure.file.name }}</span>
          <span :class="styles.error">{{ failure.message }}</span>
        </li>
      </ul>
    </details>
  </section>
</template>
