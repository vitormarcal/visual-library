<script setup lang="ts">
import styles from './GalleryTagFilters.module.css'

type ImageTag = {
  id: string
  name: string
  normalizedName: string
}

type TagSummary = ImageTag & {
  imageCount: number
  lastUsedAt: string
}

const props = defineProps<{
  activeFilters: ImageTag[]
  tags: TagSummary[]
  hasLibraryTags: boolean
  notice: string
}>()

const emit = defineEmits<{
  select: [tag: ImageTag]
  remove: [normalizedName: string]
  clear: []
}>()

const open = ref(false)

const availableTags = computed(() => {
  const active = new Set(props.activeFilters.map((tag) => tag.normalizedName))
  return props.tags.filter((tag) => !active.has(tag.normalizedName)).slice(0, 16)
})

const selectTag = (tag: ImageTag) => {
  emit('select', tag)
  open.value = false
}
</script>

<template>
  <section
    v-if="hasLibraryTags || activeFilters.length > 0"
    :class="styles.wrap"
    aria-label="Tag filters"
  >
    <div
      v-if="activeFilters.length > 0"
      :class="styles.activeBar"
    >
      <button
        v-for="tag in activeFilters"
        :key="tag.normalizedName"
        :class="[styles.chip, styles.activeChip]"
        type="button"
        :aria-label="`Remove ${tag.name} filter`"
        @click="$emit('remove', tag.normalizedName)"
      >
        {{ tag.name }}
        <span aria-hidden="true">×</span>
      </button>

      <button
        :class="styles.clearButton"
        type="button"
        @click="$emit('clear')"
      >
        Clear
      </button>
    </div>

    <div
      v-if="hasLibraryTags"
      :class="styles.shortcut"
    >
      <button
        :class="styles.tagsButton"
        type="button"
        :aria-expanded="open"
        @click="open = !open"
      >
        Tags
      </button>

      <div
        v-if="open"
        :class="styles.popover"
      >
        <button
          v-for="tag in availableTags"
          :key="tag.id"
          :class="styles.chip"
          type="button"
          @click="selectTag(tag)"
        >
          {{ tag.name }}
        </button>
      </div>
    </div>

    <p
      v-if="notice"
      :class="styles.notice"
    >
      {{ notice }}
    </p>
  </section>
</template>
