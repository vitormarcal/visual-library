<script setup lang="ts">
import type { ImageRecord } from '../types/image'
import { interceptLibraryLink } from '../utils/library-navigation'
const props = defineProps<{
  reference: ImageRecord | null; images: ImageRecord[]; busy: boolean; preparing: boolean
  failed: boolean; error: string; partial: boolean; failedCount: number; preparedCount: number; totalCount: number
  hasMore: boolean; imageHref: (id: string) => string; backHref: string
}>()
const emit = defineEmits<{ open: [id: string]; delete: [id: string]; more: []; retry: []; refresh: []; back: [] }>()
const sentinel = ref<HTMLElement | null>(null)
const columns = ref(5)
const buckets = computed(() => Array.from({ length: columns.value }, (_, column) => props.images.filter((_, index) => index % columns.value === column)))
let observer: IntersectionObserver | undefined
const updateColumns = () => { const width = window.innerWidth; columns.value = width <= 420 ? 1 : width <= 640 ? 2 : width <= 900 ? 3 : width <= 1180 ? 4 : 5 }
onMounted(() => {
  updateColumns()
  window.addEventListener('resize', updateColumns, { passive: true })
  observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting) && props.hasMore && !props.busy && !props.error) emit('more') }, { rootMargin: '400px' })
  if (sentinel.value) observer.observe(sentinel.value)
})
watch(() => [props.hasMore, props.busy, props.error], async () => { await nextTick(); observer?.disconnect(); if (sentinel.value) observer?.observe(sentinel.value) })
onBeforeUnmount(() => { observer?.disconnect(); window.removeEventListener('resize', updateColumns) })
</script>

<template>
  <section aria-label="Similar images" class="similarGallery">
    <div class="similarContext">
      <a :href="backHref" @click="interceptLibraryLink($event) && emit('back')">← Back</a>
      <div v-if="reference" class="similarReference">
        <ProgressiveImage :src="reference.thumbnailSrc || reference.src" :alt="`Reference: ${reference.originalName || 'saved image'}`" :width="reference.width" :height="reference.height" />
        <p>Similar to this image<span>Colors, appearance and composition · Entire gallery</span></p>
      </div>
    </div>
    <p v-if="preparing && !error" class="similarStatus" role="status">Preparing similar images. {{ preparedCount }} of {{ totalCount }} ready. You can continue browsing.</p>
    <p v-if="failed && !error" class="similarStatus" role="status">Could not prepare similar images. <button type="button" :disabled="busy" @click="emit('retry')">Try again</button></p>
    <p v-if="partial && images.length" class="similarStatus" role="status">More images may be available as preparation finishes. <button type="button" :disabled="busy" @click="emit('refresh')">Refresh results</button></p>
    <p v-if="!preparing && failedCount" class="similarStatus">{{ failedCount }} {{ failedCount === 1 ? 'image is' : 'images are' }} unavailable for similarity.</p>
    <div v-if="images.length" class="similarColumns" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
      <GalleryGrid v-for="(bucket, column) in buckets" v-show="bucket.length" :key="column" :images="bucket" single-column :loading="false" :image-href="imageHref" @open="emit('open', $event)" @delete="emit('delete', $event)" />
    </div>
    <p v-else-if="!preparing && !failed && !busy && !error" class="similarStatus">No similar images are available yet.</p>
    <p v-if="error" class="similarStatus" role="status">{{ error }} <button type="button" :disabled="busy" @click="emit('retry')">Try again</button></p>
    <div ref="sentinel" class="similarMore">
      <p v-if="busy && !preparing" role="status">Loading similar images.</p>
      <button v-else-if="hasMore && !error" type="button" @click="emit('more')">Load more similar images</button>
      <p v-else-if="images.length && !busy && !error">End of similar images.</p>
    </div>
  </section>
</template>

<style scoped>
.similarContext { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin: 16px 0 24px; }
.similarContext a, button { display: inline-flex; align-items: center; min-height: 44px; border: 0; border-radius: 16px; padding: 8px 14px; color: var(--color-ink); background: var(--color-surface-card); font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
.similarContext a:focus-visible, button:focus-visible { outline: 2px solid var(--color-focus-outer); outline-offset: 2px; }
.similarReference { display: flex; gap: 12px; align-items: center; min-width: 0; }
.similarReference :deep(img) { display: block; width: 64px; height: 80px; object-fit: contain; border-radius: 16px; background: var(--color-surface-card); }
.similarReference p { margin: 0; font-size: 14px; }
.similarReference span { display: block; color: var(--color-mute); font-size: 12px; margin-top: 4px; }
.similarStatus, .similarMore { color: var(--color-mute); font-size: 14px; line-height: 1.4; margin: 24px 0; }
.similarColumns { display: grid; gap: 8px; align-items: start; }
.similarMore { min-height: 44px; text-align: center; }
button:disabled { opacity: 0.6; cursor: default; }
</style>
