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
}>()

defineEmits<{
  delete: [id: string]
}>()
</script>

<template>
  <section aria-label="Saved images">
    <p v-if="loading" :class="styles.empty">Loading library.</p>
    <p v-else-if="images.length === 0" :class="styles.empty">No images saved yet.</p>

    <div v-else :class="styles.grid">
      <figure
        v-for="image in images"
        :key="image.id"
        :class="styles.card"
      >
        <img
          :src="image.src"
          :alt="image.originalName || 'Saved image'"
          loading="lazy"
        >
        <button
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
