<script setup lang="ts">
import styles from './SaveDropzone.module.css'
import { acceptImageTypes, filesFromTransfer, isImageFile, uploadSummary, type UploadResult } from '../utils/image-upload'

const props = defineProps<{
  expanded?: boolean
  discovering?: boolean
  selecting?: boolean
  tags: string[]
  notice: string
  noticeKind: 'success' | 'error'
  saving: boolean
  progress: { current: number; total: number } | null
  result: UploadResult | null
}>()

const emit = defineEmits<{
  open: []
  close: []
  save: [files: File[]]
  saveUrl: [url: string]
  error: [message: string]
  retry: []
  dismiss: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const pickerButton = ref<HTMLButtonElement | null>(null)
const failureDetails = ref<HTMLDetailsElement | null>(null)
const urlDraft = ref('')
const submitUrl = () => { if (!captureBusy() && urlDraft.value.trim()) { emit('saveUrl', urlDraft.value.trim()); urlDraft.value = '' } }
const dragging = ref(false)
const busyAttempt = ref(false)
let dragDepth = 0
let returnFocusToPicker = false
const hasRetryableFailures = computed(() => props.result?.failures.some((failure) => failure.retryable) ?? false)
const statusText = computed(() => {
  if (props.discovering) return 'Reading URL…'
  if (props.saving && props.selecting) return 'Saving selected images…'
  if (props.saving) {
    const progress = props.progress
    const message = progress && progress.total > 1 ? `Saving ${progress.current} of ${progress.total}…` : 'Saving image…'
    return busyAttempt.value ? `${message} Please wait before adding more images.` : message
  }
  if (props.selecting) return 'Choose images below, then save or close the selection.'
  if (props.result) return uploadSummary(props.result)
  if (props.notice) return props.notice
  return 'Paste an image, image URL or page URL, drop files, or choose images'
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
  if (event.defaultPrevented || (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))) return
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
  if (props.expanded) pickerButton.value?.focus({ preventScroll: true })
  else emit('close')
}
const retry = async () => {
  if (props.saving) return
  returnFocusToPicker = true
  emit('open')
  emit('retry')
  await nextTick()
  // The retry control disappears during saving; the focusable capture surface remains.
  captureSurface.value?.scrollIntoView({ block: 'start', behavior: 'instant' })
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
const viewSelection = () => document.querySelector('[data-page-selection]')?.scrollIntoView({ block: 'start' })
defineExpose({ handlePaste, handleDrop, focus: () => {
  captureSurface.value?.scrollIntoView({ block: 'start', behavior: 'instant' })
  captureSurface.value?.focus({ preventScroll: true })
} })
</script>

<template>
  <section
    v-show="expanded || saving || discovering"
    id="library-capture"
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
    <button type="button" :class="styles.collapse" aria-label="Collapse capture" :disabled="saving || discovering" @click="emit('close')">×</button>
    <div :class="styles.copy">
      <strong>Save images</strong>
      <span
        :class="[styles.status, !saving && (result || notice) && styles.result, !saving && !result && notice && noticeKind === 'error' && styles.error]"
        role="status" aria-live="polite" aria-atomic="true"
      >{{ statusText }}<span v-if="notice && (saving || result)" :class="noticeKind === 'error' && styles.error"> {{ notice }}</span></span>
      <div v-if="tags.length" :class="styles.tagContext" role="status" aria-live="polite">
        <span>{{ saving ? 'Applying tags:' : 'New images will receive these tags:' }}</span>
        <span v-for="tag in tags" :key="tag" :class="styles.tag">{{ tag }}</span>
      </div>
    </div>

    <button
      ref="pickerButton" :class="[styles.uploadButton, selecting && styles.secondary]" type="button"
      :disabled="saving" @click="fileInput?.click()"
    >Choose images</button>
    <input
      ref="fileInput" :class="styles.fileInput" type="file" multiple
      :accept="acceptImageTypes" :disabled="saving" tabindex="-1" aria-hidden="true"
      @change="handleInput"
    >
    <form :class="styles.urlForm" @submit.prevent="submitUrl">
      <label for="capture-url">Image or page URL</label>
      <input id="capture-url" v-model="urlDraft" type="url" placeholder="https://" :disabled="saving || discovering || selecting" required>
      <button type="submit" :class="[styles.secondary]" :disabled="saving || discovering || selecting">Continue</button>
    </form>
  </section>

  <p v-if="!expanded && !saving && !discovering && (notice || result || selecting)" :class="[styles.compactStatus, notice && !result && noticeKind === 'error' && styles.error]" role="status" aria-live="polite">
    {{ statusText }} <button v-if="selecting" type="button" :class="styles.tertiary" @click="viewSelection()">View selection</button>
  </p>
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
