<script setup lang="ts">
const props = defineProps<{
  openLabel?: string; disabled?: boolean; cachedSrc?: string
  url: string; width: number | null; height: number | null
  queue: <T>(signal: AbortSignal, task: () => Promise<T>) => Promise<T>
  retain: (url: string, bytes: number, release: () => void) => void
  forget: (url: string) => void
}>()
const emit = defineEmits<{ open: [event: MouseEvent, src: string] }>()
const api = useNuxtApp().$libraryApi
const root = ref<HTMLElement | null>(null), src = ref(''), failed = ref(false)
let observer: IntersectionObserver | undefined, controller: AbortController | undefined, mounted = true
const release = () => {
  controller?.abort(); controller = undefined
  if (src.value && src.value !== props.cachedSrc) { props.forget(src.value); URL.revokeObjectURL(src.value) }
  src.value = ''
}
const load = async () => {
  if (props.cachedSrc) { src.value = props.cachedSrc; return }
  if (controller) return
  const attempt = new AbortController(); controller = attempt
  failed.value = false
  try {
    const blob = await props.queue(attempt.signal, () => api<Blob>('/api/page-image-preview', {
      method: 'POST', body: { url: props.url }, responseType: 'blob', signal: attempt.signal,
    }))
    if (mounted && !attempt.signal.aborted) {
      src.value = URL.createObjectURL(blob)
      props.retain(src.value, blob.size, () => { release(); failed.value = true })
    }
  } catch { if (mounted && !attempt.signal.aborted) failed.value = true }
}
onMounted(() => {
  observer = new IntersectionObserver(entries => { for (const entry of entries) { if (entry.isIntersecting) void load(); else if (!src.value) release() } }, { rootMargin: '100px' })
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => { mounted = false; observer?.disconnect(); release() })
</script>
<template>
  <div ref="root" class="pagePreview" :style="{ aspectRatio: width && height ? `${width}/${height}` : '3/4' }">
    <button v-if="openLabel" class="openImage" type="button" :aria-label="openLabel" :disabled="disabled" @click="emit('open', $event, src)">
      <img v-if="src" :src="src" alt="" />
      <span v-else>{{ failed ? 'Preview unavailable' : 'Loading preview…' }}</span>
    </button>
    <img v-else-if="src" :src="src" alt="" />
    <span v-else-if="!failed">Loading preview…</span>
    <button v-if="failed" class="retryPreview" type="button" @click.stop="release(); load()">Preview unavailable. Retry</button>
  </div>
</template>
<style scoped>
.pagePreview { position: relative; display: grid; place-items: center; background: var(--color-surface-card); border-radius: var(--radius-md); overflow: hidden; min-height: 80px; color: var(--color-mute); font-size: 14px; }
.pagePreview img { display: block; width: 100%; height: 100%; object-fit: contain; }
.pagePreview .openImage { display: grid; place-items: center; width: 100%; height: 100%; min-height: 44px; padding: 0; border: 0; border-radius: var(--radius-md); background: transparent; color: inherit; font: inherit; cursor: pointer; }
.pagePreview .openImage:focus-visible { outline: 2px solid var(--color-focus-outer); outline-offset: -2px; }
.pagePreview .retryPreview { position: absolute; bottom: 8px; min-height: 44px; background: var(--color-secondary-bg); border: 0; color: var(--color-body); }
</style>
