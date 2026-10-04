<script setup lang="ts">
import styles from './GalleryTagFilters.module.css'
import { normalizeSearch } from '../utils/image-search'

type ImageTag = { id: string; name: string; normalizedName: string }
type TagSummary = ImageTag & { imageCount: number; lastUsedAt: string }

const props = defineProps<{
  activeFilters: ImageTag[]
  tags: TagSummary[]
  hasLibraryTags: boolean
  notice: string
}>()
const query = defineModel<string>('query', { default: '' })
const emit = defineEmits<{
  select: [tag: ImageTag]
  remove: [normalizedName: string]
  clear: []
}>()
const availableTags = computed(() => {
  const active = new Set(props.activeFilters.map((tag) => tag.normalizedName))
  return props.tags.filter((tag) => !active.has(tag.normalizedName))
    .sort((a, b) => b.imageCount - a.imageCount || a.name.localeCompare(b.name))
})
const suggestedTags = computed(() => {
  const terms = normalizeSearch(query.value).split(' ').filter(Boolean)
  return terms.length
    ? availableTags.value.filter((tag) => terms.every((term) => normalizeSearch(tag.name).includes(term)))
    : availableTags.value.slice(0, 6)
})
const selectTag = (tag: ImageTag) => {
  // Keep the query if the existing three-filter limit prevents selection.
  if (props.activeFilters.length < 3) query.value = ''
  emit('select', tag)
}
</script>

<template>
  <section :class="styles.wrap" aria-label="Search library">
    <div :class="styles.searchBar">
      <svg :class="styles.searchIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </svg>
      <input
        v-model="query"
        data-library-search
        type="search"
        aria-label="Search by tag or filename"
        placeholder="Search by tag or filename"
        :class="[styles.searchInput, { [styles.hasQuery]: query }]"
      >
      <button v-if="query" type="button" :class="styles.clearSearch" aria-label="Clear search" @click="query = ''">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>

    <div v-if="activeFilters.length" :class="styles.activeBar">
      <button
        v-for="tag in activeFilters" :key="tag.normalizedName"
        :class="[styles.chip, styles.activeChip]" type="button"
        :aria-label="`Remove ${tag.name} filter`" @click="$emit('remove', tag.normalizedName)"
      >{{ tag.name }} <span aria-hidden="true">×</span></button>
      <button :class="styles.clearButton" type="button" @click="$emit('clear')">Clear all</button>
    </div>

    <div v-if="suggestedTags.length" :class="styles.suggestions" aria-label="Suggested tags">
      <button v-for="tag in suggestedTags" :key="tag.id" :class="styles.chip" type="button" @click="selectTag(tag)">
        {{ tag.name }}
      </button>
    </div>

    <details v-if="hasLibraryTags && availableTags.length" :class="styles.allTags">
      <summary>All tags</summary>
      <div :class="styles.tagList">
        <button v-for="tag in availableTags" :key="tag.id" :class="styles.chip" type="button" @click="selectTag(tag)">
          {{ tag.name }}
        </button>
      </div>
    </details>
    <p v-if="notice" :class="styles.notice" role="status">{{ notice }}</p>
  </section>
</template>
