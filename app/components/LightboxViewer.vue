<script setup lang="ts">
import styles from './LightboxViewer.module.css'

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
  image: ImageRecord
  hasPrevious: boolean
  hasNext: boolean
}>()

const emit = defineEmits<{
  close: []
  previous: []
  next: []
}>()

const viewer = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
let previousBodyOverflow = ''

const focusableControls = () => {
  if (!viewer.value) {
    return []
  }

  return Array.from(viewer.value.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    emit('previous')
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    emit('next')
  }

  if (event.key === 'Tab') {
    const controls = focusableControls()

    if (controls.length === 0) {
      event.preventDefault()
      return
    }

    const firstControl = controls[0]
    const lastControl = controls[controls.length - 1]

    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault()
      lastControl?.focus()
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault()
      firstControl?.focus()
    }
  }
}

onMounted(async () => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', handleKeydown)

  await nextTick()
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <section
    ref="viewer"
    :class="styles.overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Image viewer"
    @click.self="$emit('close')"
  >
    <button
      ref="closeButton"
      :class="[styles.control, styles.closeButton]"
      type="button"
      aria-label="Close viewer"
      @click="$emit('close')"
    >
      Close
    </button>

    <button
      :class="[styles.control, styles.navButton, styles.previousButton]"
      type="button"
      aria-label="Previous image"
      :disabled="!hasPrevious"
      @click="$emit('previous')"
    >
      Prev
    </button>

    <img
      :class="styles.image"
      :src="image.src"
      :alt="image.originalName || 'Saved image'"
    >

    <button
      :class="[styles.control, styles.navButton, styles.nextButton]"
      type="button"
      aria-label="Next image"
      :disabled="!hasNext"
      @click="$emit('next')"
    >
      Next
    </button>
  </section>
</template>
