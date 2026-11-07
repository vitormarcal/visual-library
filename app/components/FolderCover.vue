<script setup lang="ts">
type Preview = { id: string; thumbnailSrc?: string | null; src: string; width?: number | null; height?: number | null }
defineProps<{ previews: Preview[]; dimensions: Record<string, { width: number; height: number }> }>()
const emit = defineEmits<{ dimension: [id: string, width: number, height: number] }>()
const failed = ref(new Set<string>())
const loaded = (event: Event, id: string) => {
  const image = event.target as HTMLImageElement
  emit('dimension', id, image.naturalWidth, image.naturalHeight)
}
</script>
<template>
  <span class="folderMosaic" :class="{ single: previews.length <= 1, pair: previews.length === 2 }">
    <span v-for="(preview, index) in previews" :key="preview.id" class="tile" :class="{ primary: index === 0 }">
      <ProgressiveImage v-if="!failed.has(preview.id)" :src="preview.thumbnailSrc || preview.src" alt=""
        :width="preview.width || dimensions[preview.id]?.width" :height="preview.height || dimensions[preview.id]?.height"
        @load="loaded($event, preview.id)" @error="failed = new Set([...failed, preview.id])" />
      <span v-else class="placeholder" aria-hidden="true">Image unavailable</span>
    </span>
    <span v-if="!previews.length" class="placeholder" aria-hidden="true">Cover unavailable</span>
  </span>
</template>
<style scoped>
.folderMosaic { display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 3px; aspect-ratio: 3 / 2; overflow: hidden; border-radius: var(--radius-md); background: var(--color-surface-card); }
.tile { display: block; min-width: 0; min-height: 0; overflow: hidden; }
.primary { grid-row: 1 / -1; }
.tile :deep(img) { display: block; width: 100%; height: 100%; object-fit: cover; }
.single { grid-template-columns: 1fr; grid-template-rows: 1fr; }
.pair { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
.placeholder { display: grid; place-items: center; height: 100%; padding: 8px; color: var(--color-mute); font-size: 12px; line-height: 1.3; text-align: center; }
</style>
