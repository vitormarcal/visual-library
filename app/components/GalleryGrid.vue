<script setup lang="ts">
import styles from './GalleryGrid.module.css'
import { interceptLibraryLink } from '../utils/library-navigation'

type ImageRecord = {
  id: string
  filename: string
  originalName: string | null
  mimeType: string
  sizeBytes: number
  createdAt: string
  thumbnailSrc?: string | null
  src: string
  width?: number | null
  height?: number | null
}

const props = defineProps<{
  images: ImageRecord[]
  loading: boolean
  emptyText?: string
  selecting?: boolean
  selectedIds?: string[]
  busy?: boolean
  singleColumn?: boolean
  compact?: boolean
  hasMore?: boolean
  loadingMore?: boolean
  moreError?: boolean
  imageHref: (id: string) => string
}>()

const emit = defineEmits<{
  toggle: [id: string]
  open: [id: string]
  delete: [id: string]
  more: []
}>()
const open = (event: MouseEvent, id: string) => {
  if (props.selecting) { if (!props.busy) emit('toggle', id); return }
  if (interceptLibraryLink(event) && !props.busy) emit('open', id)
}
const grid = ref<HTMLElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
const viewport = ref(1440)
const containerWidth = ref(1200)
const natural = ref<Record<string, { width: number; height: number }>>({})
const columns = computed(() => props.singleColumn ? 1 : props.compact ? viewport.value <= 640 ? 2 : 4 : viewport.value <= 350 ? 1 : viewport.value <= 640 ? 2 : viewport.value <= 900 ? 3 : viewport.value <= 1180 ? 4 : 5)
const layout = computed(() => {
  const count = columns.value, gap = 8, width = (containerWidth.value - gap * (count - 1)) / count
  const heights = Array<number>(count).fill(0)
  const items = props.images.map(image => {
    const column = heights.indexOf(Math.min(...heights)), top = heights[column]!
    const dimensions = image.width && image.height ? { width: image.width, height: image.height } : natural.value[image.id]
    const height = width * (dimensions ? dimensions.height / dimensions.width : 1)
    heights[column] = top + height + gap
    return { position: 'absolute' as const, top: `${top}px`, left: `${column * (width + gap)}px`, width: `${width}px` }
  })
  return { items, height: Math.max(0, ...heights) - (props.images.length ? gap : 0) }
})
let resizeObserver: ResizeObserver | undefined
let observer: IntersectionObserver | undefined
let resizeFrame = 0
const measure = () => {
  const element = grid.value
  if (!element) return
  const width = element.clientWidth
  if (!width) return
  if (width === containerWidth.value && viewport.value === innerWidth) return
  // Keep the first visible card anchored across a responsive reflow.
  const anchor = [...element.querySelectorAll<HTMLElement>('[data-lightbox-open-id]')].find(node => node.getBoundingClientRect().bottom > 100)
  const top = anchor?.getBoundingClientRect().top
  containerWidth.value = width; viewport.value = innerWidth
  if (anchor && top !== undefined && scrollY > 0) void nextTick(() => {
    if (anchor.isConnected) scrollBy(0, anchor.getBoundingClientRect().top - top)
  })
}
const observe = () => { observer?.disconnect(); if (sentinel.value) observer?.observe(sentinel.value) }
onMounted(() => {
  resizeObserver = new ResizeObserver(() => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(measure) })
  if (grid.value) resizeObserver.observe(grid.value)
  measure()
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && props.hasMore && !props.loadingMore && !props.moreError) emit('more')
  }, { rootMargin: '400px' })
  observe()
})
watch(grid, element => { resizeObserver?.disconnect(); if (element) { resizeObserver?.observe(element); measure() } })
watch([sentinel, () => props.hasMore, () => props.loadingMore], async () => { await nextTick(); observe() })
onBeforeUnmount(() => { observer?.disconnect(); resizeObserver?.disconnect(); cancelAnimationFrame(resizeFrame) })
</script>

<template>
  <section aria-label="Saved images" :data-library-count="images.length">
    <p v-if="loading" :class="styles.empty">Loading library.</p>
    <p v-else-if="images.length === 0" :class="styles.empty">{{ emptyText || 'No images saved yet.' }}</p>

    <div v-else ref="grid" :class="styles.grid" :style="{ height: `${layout.height}px` }">
      <figure
        v-for="(image, index) in images"
        :key="image.id"
        :style="layout.items[index]"
        :class="[styles.card, { [styles.selected]: selectedIds?.includes(image.id) }]"
      >
        <component
          :is="selecting ? 'button' : 'a'"
          :class="styles.openButton"
          :type="selecting ? 'button' : undefined"
          :href="selecting ? undefined : imageHref(image.id)"
          :aria-label="`${selecting ? 'Select' : 'Open'} ${image.originalName || 'saved image'}`"
          :aria-pressed="selecting ? Boolean(selectedIds?.includes(image.id)) : undefined"
          :disabled="busy"
          :aria-disabled="busy || undefined"
          :data-lightbox-open-id="image.id"
          @click="open($event, image.id)"
        >
          <ProgressiveImage
            :src="image.thumbnailSrc || image.src"
            :alt="image.originalName || 'Saved image'"
            :width="image.width" :height="image.height"
            @load="event => { const element = event.target as HTMLImageElement; if ((!image.width || !image.height) && element.naturalWidth) natural[image.id] = { width: element.naturalWidth, height: element.naturalHeight } }"
          />
        </component>
        <span v-if="selecting" :class="styles.selectionMark" aria-hidden="true">{{ selectedIds?.includes(image.id) ? '✓' : '○' }}</span>
        <div v-if="!selecting" :class="styles.cardActions">
          <LibraryMenu :label="`More actions for ${image.originalName || 'saved image'}`">
            <button type="button" :disabled="busy" @click="$emit('delete', image.id)">Remove image</button>
          </LibraryMenu>
        </div>
      </figure>
    </div>
    <div v-if="hasMore || moreError" ref="sentinel" :class="styles.more">
      <p v-if="loadingMore" role="status">Loading more images.</p>
      <template v-else>
        <p v-if="moreError" role="status">Could not load more images.</p>
        <button type="button" @click="emit('more')">{{ moreError ? 'Try again' : 'Load more images' }}</button>
      </template>
    </div>
  </section>
</template>
