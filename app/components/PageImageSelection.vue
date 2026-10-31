<script setup lang="ts">
import { createPreviewQueue, savePageImageBatch, type PageCandidate as Candidate, type PageDiscovery } from '../utils/page-image-selection'
import viewerStyles from './LightboxViewer.module.css'
import { uploadSummary, type UploadResult } from '../utils/image-upload'
import type { ImageRecord } from '../types/image'
const props = defineProps<{ page: PageDiscovery; tags: string[] }>()
const emit = defineEmits<{ close: []; saved: [image: ImageRecord]; busy: [value: boolean] }>()
const api = useNuxtApp().$libraryApi
const selected = ref<string[]>([]), completed = ref<string[]>([]), busy = ref(false), progress = ref('')
const result = shallowRef<UploadResult<Candidate>>({ saved: 0, duplicates: 0, failures: [] })
const failures = computed(() => result.value.failures)
const previewQueue = createPreviewQueue()
const blobs = new Map<string, { bytes: number; release: () => void }>()
const forget = (url: string) => { blobs.delete(url) }
const retain = (url: string, bytes: number, release: () => void) => {
  blobs.set(url, { bytes, release })
  while (blobs.size > 200 || [...blobs.values()].reduce((n, item) => n + item.bytes, 0) > 32 * 1024 * 1024) {
    const oldest = blobs.entries().next().value
    if (!oldest) break
    oldest[1].release()
  }
}
let enlargeOrigin: HTMLElement | null = null
const closePreview = async () => { enlarged.value = null; await nextTick(); enlargeOrigin?.focus({ preventScroll: true }) }
const enlargedSrc = ref('')
const enlarged = ref<Candidate | null>(null), dialog = ref<HTMLDialogElement | null>(null)
const available = computed(() => props.page.candidates.filter(c => !completed.value.includes(c.id)))
const closeButton = ref<HTMLButtonElement | null>(null)
const save = async (retry = false) => {
  if (busy.value) return
  const ids = retry ? failures.value.filter(f => f.retryable).map(f => f.file.id) : selected.value.filter(id => !completed.value.includes(id))
  const items = props.page.candidates.filter(c => ids.includes(c.id))
  if (!items.length) return
  busy.value = true; emit('busy', true)
  try {
    result.value = await savePageImageBatch(items, async item => {
      const saved = await api<ImageRecord | { duplicate: true }>('/api/images', { method: 'POST', body: { url: item.url, pageUrl: props.page.pageUrl, tags: props.tags } })
      if ('duplicate' in saved) return 'duplicate'
      emit('saved', saved)
      return 'saved'
    }, (current, total) => { progress.value = `Saving ${current} of ${total}…` }, item => {
      completed.value.push(item.id)
      selected.value = selected.value.filter(id => id !== item.id)
    }, retry ? result.value : { ...result.value, failures: result.value.failures.filter(f => !items.some(item => item.id === f.file.id)) })
  } finally { busy.value = false; emit('busy', false); progress.value = ''; await nextTick(); closeButton.value?.focus({ preventScroll: true }) }
}

const enlarge = async (item: Candidate, event: MouseEvent, src: string) => { enlargedSrc.value = src; enlargeOrigin = event.currentTarget as HTMLElement | null; enlarged.value = item; await nextTick(); dialog.value?.showModal() }
</script>
<template>
<section class="pageSelection" aria-label="Choose images from page">
  <div class="pageActions">
    <strong>Choose images to save</strong>
    <button type="button" :disabled="busy || !available.length" @click="selected = available.map(c => c.id)">Select all</button>
    <button type="button" :disabled="busy || !selected.length" @click="selected = []">Clear selection</button>
    <button class="primary" type="button" :disabled="busy || !selected.length" @click="save()">Save selected ({{ selected.length }})</button>
    <button ref="closeButton" type="button" :disabled="busy" @click="emit('close')">Close</button>
  </div>
  <p v-if="tags.length">New images will receive these tags: {{ tags.join(', ') }}</p>
  <p v-if="page.fallback">Images may include elements outside the post.</p>
  <p v-if="!page.candidates.length">No images found on this page.</p>
  <p role="status" aria-live="polite">{{ progress || (uploadSummary(result) || `${selected.length} selected`) }}</p>
  <button v-if="failures.some(f => f.retryable)" type="button" :disabled="busy" @click="save(true)">Retry failed</button>
  <div class="pageGrid">
    <article v-for="(item, index) in page.candidates" :key="item.id" class="pageCard">
      <PageImagePreview :open-label="`Open image ${index + 1}`" :disabled="busy" @open="(event, src) => enlarge(item, event, src)" :queue="previewQueue" :retain="retain" :forget="forget" :url="item.url" :width="item.width" :height="item.height" />
      <div class="cardActions"><label><input v-model="selected" type="checkbox" :value="item.id" :disabled="busy || completed.includes(item.id)" />{{ completed.includes(item.id) ? 'Done' : `Image ${index + 1}` }}</label></div>
      <p v-for="failure in failures.filter(f => f.file.id === item.id)" :key="failure.file.id" class="error">{{ failure.message }}</p>
    </article>
  </div>
  <dialog v-if="enlarged" ref="dialog" :class="[viewerStyles.expandedOverlay, 'previewDialog']" aria-label="Image viewer" @close="closePreview" @click.self="dialog?.close()">
    <button type="button" :class="[viewerStyles.control, viewerStyles.closeButton, 'viewerClose']" aria-label="Close viewer" @click="dialog?.close()"><span aria-hidden="true">×</span></button>
    <PageImagePreview :queue="previewQueue" :retain="retain" :forget="forget" :cached-src="enlargedSrc" :url="enlarged.url" :width="enlarged.width" :height="enlarged.height" />
  </dialog>
</section>
</template>
<style scoped>
.pageSelection{margin:16px 0 24px;color:var(--color-body)}.pageActions,.cardActions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pageActions strong{margin-right:auto;color:var(--color-ink)}.pageSelection button{min-height:44px;border:0;border-radius:var(--radius-md);padding:8px 14px;background:var(--color-secondary-bg);color:var(--color-ink);font-size:14px;font-weight:700;cursor:pointer}.pageSelection button.primary{background:var(--color-primary);color:var(--color-canvas)}.pageSelection button.primary:active{background:var(--color-primary-pressed)}.pageSelection button:active{background:var(--color-secondary-pressed)}.pageSelection button:disabled{background:var(--color-surface-card);color:var(--color-ash);cursor:default}.pageSelection :focus-visible{outline:2px solid var(--color-focus-outer);outline-offset:3px}.pageGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:16px;margin-top:16px;align-items:start}.pageCard{min-width:0}.cardActions{justify-content:space-between}.cardActions label{display:flex;gap:8px;align-items:center;min-height:44px}.cardActions input{width:20px;height:20px;accent-color:var(--color-ink)}.error{color:var(--color-error);font-size:14px}.previewDialog { width: 100vw; height: 100vh; height: 100dvh; max-width: none; max-height: none; margin: 0; border: 0; border-radius: 0;  }
.previewDialog[open] { display: grid; place-items: center; }
.previewDialog::backdrop { background: transparent; }
.previewDialog :deep(.pagePreview) { width: 100%; height: 100%; min-height: 0; aspect-ratio: auto !important; background: transparent; border-radius: 0; }
.previewDialog :deep(img) { min-height: 0; object-fit: contain; }
.pageSelection .viewerClose { width: 44px; padding: 0; border-radius: var(--radius-full); font-size: 24px; line-height: 1; background: rgba(255, 255, 255, 0.92); }
.pageSelection .viewerClose:active { background: var(--color-secondary-pressed); }

</style>
