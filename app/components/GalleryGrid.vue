<script setup lang="ts">
import styles from './GalleryGrid.module.css'

type ImageRecord = {
  id: string
  filename: string
  originalName: string | null
  mimeType: string
  sizeBytes: number
  createdAt: string
  src: string
}

defineProps<{
  images: ImageRecord[]
  loading: boolean
  emptyText?: string
  selecting?: boolean
  selectedIds?: string[]
  busy?: boolean
}>()

defineEmits<{
  toggle: [id: string]
  open: [id: string]
  delete: [id: string]
}>()
</script>

<template>
  <section aria-label="Saved images">
    <p v-if="loading" :class="styles.empty">Loading library.</p>
    <p v-else-if="images.length === 0" :class="styles.empty">{{ emptyText || 'No images saved yet.' }}</p>

    <div v-else :class="styles.grid">
      <figure
        v-for="image in images"
        :key="image.id"
        :class="[styles.card, { [styles.selected]: selectedIds?.includes(image.id) }]"
      >
        <button
          :class="styles.openButton"
          type="button"
          :aria-label="`${selecting ? 'Select' : 'Open'} ${image.originalName || 'saved image'}`"
          :aria-pressed="selecting ? Boolean(selectedIds?.includes(image.id)) : undefined"
          :disabled="busy"
          :data-lightbox-open-id="image.id"
          @click="selecting ? $emit('toggle', image.id) : $emit('open', image.id)"
        >
          <img
            :src="image.src"
            :alt="image.originalName || 'Saved image'"
            loading="lazy"
          >
        </button>
        <span v-if="selecting" :class="styles.selectionMark" aria-hidden="true">{{ selectedIds?.includes(image.id) ? '✓' : '○' }}</span>
        <button
          v-if="!selecting"
          :class="styles.deleteButton"
          type="button"
          aria-label="Remove image"
          @click="$emit('delete', image.id)"
        >
          Remove
        </button>
      </figure>
    </div>
  </section>
</template>
