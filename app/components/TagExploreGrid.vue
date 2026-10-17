<script setup lang="ts">
import styles from './TagExploreGrid.module.css'
import { orderExploreGroups } from '../utils/tag-exploration'
import { interceptLibraryLink, libraryDestination, libraryDestinationUrl } from '../utils/library-navigation'
type Group = { id: string; name: string; normalizedName: string; imageCount: number; cover: { id: string; src: string; width?: number | null; height?: number | null } | null }
const props = defineProps<{
  groups: Group[]
  loading: boolean
  error: boolean
  hasTags: boolean
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
// Keep the day and rendered depth when returning from a subject.
const exploreDay = useState('explore-day', () => {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
})
const visibleCount = useState('explore-visible-count', () => 30)
const orderedGroups = computed(() => query.value.trim() ? props.groups : orderExploreGroups(props.groups, exploreDay.value))
const batches = computed(() => {
  const visible = orderedGroups.value.slice(0, visibleCount.value)
  return Array.from({ length: Math.ceil(visible.length / 30) }, (_, index) => visible.slice(index * 30, (index + 1) * 30))
})
const hasMore = computed(() => visibleCount.value < orderedGroups.value.length)
const showMore = () => { visibleCount.value += 30 }
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
watch(query, () => { visibleCount.value = 30 })
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
  document.querySelector<HTMLInputElement>('[data-explore-search]')?.focus({ preventScroll: true })
}
</script>

<template>
  <section aria-label="Explore subjects">
    <div :class="styles.searchBar">
      <input v-model="query" data-explore-search type="search" aria-label="Search subjects" placeholder="Search subjects" :class="styles.search">
      <button v-if="query" type="button" :class="styles.clear" aria-label="Clear subject search" @click="resetQuery">×</button>
    </div>
    <p v-if="loading" :class="styles.empty" role="status">Loading subjects.</p>
    <div v-else-if="error" :class="styles.empty" role="status">
      <p>Could not load subjects.</p>
      <button type="button" :class="styles.action" @click="$emit('retry')">Try again</button>
    </div>
    <div v-else-if="!hasTags" :class="styles.empty">
      <p>Subjects appear when you add tags to saved images.</p>
      <a :href="libraryHref" :class="styles.action" @click="backToLibrary">Back to library</a>
    </div>
    <p v-else-if="!groups.length" :class="styles.empty" role="status">No subjects match your search.</p>
    <div v-else>
      <div v-for="(batch, index) in batches" :key="index" :class="styles.grid">
        <a
          v-for="group in batch" :key="group.id" :href="subjectHref(group.id)"
          :class="styles.card" :data-explore-tag-id="group.id"
          :aria-label="`Explore ${group.name}, ${group.imageCount} ${group.imageCount === 1 ? 'image' : 'images'}`"
          @click="open($event, group)"
        >
          <ProgressiveImage
            v-if="group.cover && !failed.has(group.cover.id)" :key="group.cover.id"
            :src="group.cover.src" alt=""
            :width="group.cover.width || dimensions[group.cover.id]?.width"
            :height="group.cover.height || dimensions[group.cover.id]?.height"
            @load="loaded($event, group.cover.id)" @error="imageFailed(group.cover.id)"
          />
          <span v-else :class="styles.placeholder" aria-hidden="true">{{ group.cover ? 'Image unavailable' : 'Cover unavailable' }}</span>
          <span :class="styles.label">
            <span :class="styles.name">{{ group.name }}</span>
            <span :class="styles.count" aria-hidden="true">· {{ group.imageCount }}</span>
          </span>
        </a>
      </div>
      <div v-if="hasMore" ref="sentinel" :class="styles.more">
        <button type="button" :class="styles.action" @click="showMore">Load more subjects</button>
      </div>
    </div>
  </section>
</template>
