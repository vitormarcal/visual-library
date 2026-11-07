<script setup lang="ts">
import styles from './FolderGrid.module.css'
import { interceptLibraryLink, libraryDestination, libraryDestinationUrl } from '../utils/library-navigation'
type Preview = { id: string; thumbnailSrc?: string | null; src: string; width?: number | null; height?: number | null }
type Group = { previews: Preview[]; id: string; name: string; normalizedName: string; imageCount: number }
const props = defineProps<{
  groups: Group[]
  loading: boolean
  error: boolean
  hasTags: boolean
  restoreFocusId?: string | null
  dimensions: Record<string, { width: number; height: number }>
  libraryHref: string
}>()
const query = defineModel<string>('query', { default: '' })
const emit = defineEmits<{
  open: [group: Group]
  library: []
  retry: []
  dimension: [id: string, width: number, height: number]
}>()
const failed = ref(new Set<string>())
const visibleCount = useState('folders-visible-count', () => 30)
const visibleGroups = computed(() => props.groups.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < props.groups.length)
const showMore = () => { visibleCount.value += 30 }
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
watch(query, () => { visibleCount.value = 30 })
// A restored directory can point beyond the first batch, including after reload.
watch([() => props.restoreFocusId, () => props.groups], () => {
  const index = props.groups.findIndex(group => group.id === props.restoreFocusId)
  if (index >= 0) visibleCount.value = Math.max(visibleCount.value, index + 1)
}, { immediate: true })
onMounted(() => {
  if (!('IntersectionObserver' in window)) return
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && hasMore.value) showMore()
  }, { rootMargin: '400px' })
  if (sentinel.value) observer.observe(sentinel.value)
})
watch(sentinel, (element) => {
  observer?.disconnect()
  if (element) observer?.observe(element)
})
onBeforeUnmount(() => observer?.disconnect())
const loaded = (event: Event, id: string) => {
  const image = event.target as HTMLImageElement
  emit('dimension', id, image.naturalWidth, image.naturalHeight)
}
const imageFailed = (id: string) => { failed.value = new Set([...failed.value, id]) }
const open = (event: MouseEvent, group: Group) => { if (interceptLibraryLink(event)) emit('open', group) }
const backToLibrary = (event: MouseEvent) => { if (interceptLibraryLink(event)) emit('library') }
const subjectHref = (id: string) => libraryDestinationUrl({ ...libraryDestination('subject'), subjectId: id })
const resetQuery = async () => {
  query.value = ''
  await nextTick()
  document.querySelector<HTMLInputElement>('[data-folder-search]')?.focus({ preventScroll: true })
}
</script>

<template>
  <section aria-label="Folders">
    <div v-if="loading" :class="styles.grid" role="status" aria-label="Loading folders">
      <span v-for="n in 8" :key="n" :class="styles.skeleton" aria-hidden="true" />
    </div>
    <div v-else-if="error" :class="styles.empty" role="status">
      <p>Could not load folders.</p>
      <button type="button" :class="styles.action" @click="$emit('retry')">Try again</button>
    </div>
    <div v-else-if="!hasTags" :class="styles.empty">
      <p>Folders appear automatically when you add tags to saved images.</p>
      <a :href="libraryHref" :class="styles.action" @click="backToLibrary">View images</a>
    </div>
    <div v-else-if="!groups.length" :class="styles.empty" role="status">
      <p>No folders match your search.</p><button type="button" :class="styles.action" @click="resetQuery">Clear search</button>
    </div>
    <div v-else>
      <div :class="styles.grid">
        <a
          v-for="group in visibleGroups" :key="group.id" :href="subjectHref(group.id)"
          :class="styles.card" :data-folder-tag-id="group.id"
          :aria-label="`Open folder ${group.name}, ${group.imageCount} ${group.imageCount === 1 ? 'image' : 'images'}`"
          @click="open($event, group)"
        >
          <span :class="[styles.mosaic, group.previews.length <= 1 && styles.single, group.previews.length === 2 && styles.pair]">
            <span v-for="(preview, index) in group.previews" :key="preview.id" :class="[styles.tile, index === 0 && styles.primary]">
              <ProgressiveImage v-if="!failed.has(preview.id)" :src="preview.thumbnailSrc || preview.src" alt=""
                :width="preview.width || dimensions[preview.id]?.width" :height="preview.height || dimensions[preview.id]?.height"
                @load="loaded($event, preview.id)" @error="imageFailed(preview.id)" />
              <span v-else :class="styles.placeholder" aria-hidden="true">Image unavailable</span>
            </span>
            <span v-if="!group.previews.length" :class="styles.placeholder" aria-hidden="true">Cover unavailable</span>
          </span>
          <span :class="styles.label">
            <span :class="styles.name">{{ group.name }}</span>
            <span :class="styles.count">{{ group.imageCount }} {{ group.imageCount === 1 ? 'image' : 'images' }}</span>
          </span>
        </a>
      </div>
      <div v-if="hasMore" ref="sentinel" :class="styles.more">
        <button type="button" :class="styles.action" @click="showMore">Load more folders</button>
      </div>
    </div>
  </section>
</template>
