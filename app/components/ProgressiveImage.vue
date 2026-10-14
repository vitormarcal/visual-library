<script setup lang="ts">
const props = defineProps<{
  src: string
  alt: string
  width?: number | null
  height?: number | null
}>()
const emit = defineEmits<{ load: [event: Event]; error: [event: Event] }>()
const element = ref<HTMLImageElement | null>(null)
// Shared across remounts in this tab; the browser owns the actual byte cache.
const activated = useState<Record<string, true>>('activated-library-images', () => ({}))
const active = computed(() => Boolean(activated.value[props.src]))
const natural = ref<{ width: number; height: number } | null>(null)
const dimensions = computed(() => props.width && props.height ? { width: props.width, height: props.height } : natural.value)
const loaded = (event: Event) => {
  const image = event.target as HTMLImageElement
  if (image.naturalWidth && image.naturalHeight) natural.value = { width: image.naturalWidth, height: image.naturalHeight }
  emit('load', event)
}
let observer: IntersectionObserver | undefined
const activate = () => {
  if (!active.value) activated.value[props.src] = true
  observer?.disconnect()
}
const observe = () => {
  observer?.disconnect()
  if (active.value || !element.value) return
  if (!('IntersectionObserver' in window)) { activate(); return }
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) activate()
  }, { rootMargin: '300px 0px' })
  observer.observe(element.value)
}
onMounted(observe)
watch(() => props.src, () => { natural.value = null; observe() }, { flush: 'post' })
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <img
    ref="element" :src="active ? src : undefined" :alt="alt"
    :width="width || undefined" :height="height || undefined"
    :style="{ aspectRatio: dimensions ? `${dimensions.width} / ${dimensions.height}` : '1 / 1' }"
    decoding="async"
    @load="loaded($event)" @error="emit('error', $event)"
  >
</template>
