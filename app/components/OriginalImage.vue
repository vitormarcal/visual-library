<script setup lang="ts">
const props = defineProps<{ image: { src: string; thumbnailSrc?: string | null; originalName: string | null; width: number | null; height: number | null } }>()
const emit = defineEmits<{ load: [event: Event] }>()
const ready = ref(false), failed = ref(false), previewFailed = ref(false), previewGone = ref(false), attempt = ref(0)
const natural = ref<{ width: number; height: number } | null>(null)
const ratio = computed(() => props.image.width && props.image.height ? `${props.image.width} / ${props.image.height}` : natural.value ? `${natural.value.width} / ${natural.value.height}` : '1 / 1')
let version = 0
let previewTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => { version++; clearTimeout(previewTimer) })
watch(() => props.image.src, () => { version++; clearTimeout(previewTimer); ready.value = false; failed.value = false; previewFailed.value = false; previewGone.value = false; natural.value = null; attempt.value = 0 }, { flush: 'sync' })
const loaded = async (event: Event) => {
  const current = version, image = event.target as HTMLImageElement
  await image.decode().catch(() => {})
  if (current !== version || image.getAttribute('src') !== props.image.src) return
  if (image.naturalWidth && image.naturalHeight) natural.value = { width: image.naturalWidth, height: image.naturalHeight }
  ready.value = true; failed.value = false; emit('load', event)
  // Keep the preview underneath for the original's fade, including when motion is reduced.
  previewTimer = setTimeout(() => { if (current === version) previewGone.value = true }, 200)
}
const originalError = (event: Event) => { if ((event.target as HTMLImageElement).getAttribute('src') === props.image.src) failed.value = true }
const previewError = (event: Event) => { if ((event.target as HTMLImageElement).getAttribute('src') === props.image.thumbnailSrc) previewFailed.value = true }
const retry = () => { version++; failed.value = false; attempt.value++ }
</script>
<template>
  <div class="originalImageStage" :style="{ aspectRatio: ratio }">
    <img v-if="!previewGone && image.thumbnailSrc && !previewFailed" :key="image.thumbnailSrc" class="originalPreview" :src="image.thumbnailSrc" alt="" aria-hidden="true" decoding="async" @error="previewError">
    <img :key="`${image.src}-${attempt}`" class="originalFull" :class="{ ready }" :src="image.src" :alt="image.originalName || 'Saved image'" :width="image.width || undefined" :height="image.height || undefined" decoding="async" @load="loaded" @error="originalError">
    <button v-if="failed" class="originalRetry" type="button" @click.stop="retry">Could not load original. Try again</button>
  </div>
</template>
<style scoped>
.originalImageStage { position: relative; overflow: hidden; }
.originalFull { display: block; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity 180ms ease; }
.originalFull.ready { opacity: 1; }
.originalPreview { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
.originalRetry { position: absolute; bottom: 8px; left: 8px; max-width: calc(100% - 16px); min-height: 44px; padding: 8px 14px; border: 0; border-radius: var(--radius-md); color: var(--color-ink); background: var(--color-surface-card); font: inherit; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .originalFull { transition: none; } }
</style>
