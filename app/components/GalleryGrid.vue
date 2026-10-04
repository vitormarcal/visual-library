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
  src: string
}

const props = defineProps<{
  images: ImageRecord[]
  loading: boolean
  emptyText?: string
  selecting?: boolean
  selectedIds?: string[]
  busy?: boolean
  imageHref: (id: string) => string
}>()

const emit = defineEmits<{
  toggle: [id: string]
  open: [id: string]
  delete: [id: string]
}>()
const open = (event: MouseEvent, id: string) => {
  if (props.selecting) { if (!props.busy) emit('toggle', id); return }
  if (interceptLibraryLink(event) && !props.busy) emit('open', id)
}
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
          <img
            :src="image.src"
            :alt="image.originalName || 'Saved image'"
            loading="lazy"
          >
        </component>
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
