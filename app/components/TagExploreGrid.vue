<script setup lang="ts">
import styles from './TagExploreGrid.module.css'
import { interceptLibraryLink, libraryDestination, libraryDestinationUrl } from '../utils/library-navigation'
type Group = { id: string; name: string; normalizedName: string; imageCount: number; cover: { id: string; src: string } | null }
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
const ratio = (group: Group) => {
  const dimension = group.cover && props.dimensions[group.cover.id]
  return dimension ? `${dimension.width} / ${dimension.height}` : undefined
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
    <div v-else :class="styles.grid">
      <a
        v-for="group in groups" :key="group.id" :href="subjectHref(group.id)"
        :class="styles.card" :data-explore-tag-id="group.id"
        :aria-label="`Explore ${group.name}, ${group.imageCount} ${group.imageCount === 1 ? 'image' : 'images'}`"
        @click="open($event, group)"
      >
        <img
          v-if="group.cover && !failed.has(group.cover.id)" :key="group.cover.id"
          :src="group.cover.src" alt="" loading="lazy" :style="{ aspectRatio: ratio(group) }"
          @load="loaded($event, group.cover.id)" @error="imageFailed(group.cover.id)"
        >
        <span v-else :class="styles.placeholder" aria-hidden="true">{{ group.cover ? 'Image unavailable' : 'Cover unavailable' }}</span>
        <span :class="styles.label">
          <span :class="styles.name">{{ group.name }}</span>
          <span :class="styles.count" aria-hidden="true">· {{ group.imageCount }}</span>
        </span>
      </a>
    </div>
  </section>
</template>
