<script setup lang="ts">
const props = defineProps<{
  src: string
  filename: string
  originalName: string | null
  mimeType: string
}>()

const supported = ref(false)
const busy = ref(false)
const notice = ref('')
const prepared = shallowRef<File | null>(null)
const controller = new AbortController()
let disposed = false
// Keep the stored format's extension, even when the source name had a different one.
const name = computed(() => {
  const extension = props.filename.match(/\.[^.]+$/)?.[0] || ''
  const base = (props.originalName || props.filename).replace(/\.[^.]+$/, '').replace(/[\\/\u0000-\u001f\u007f]/g, '_')
  return `${base || 'image'}${extension}`
})

onMounted(() => {
  try {
    supported.value = Boolean(navigator.share && navigator.canShare?.({
      files: [new File([], name.value, { type: props.mimeType })],
    }))
  } catch { supported.value = false }
})
onBeforeUnmount(() => { disposed = true; controller.abort(); prepared.value = null })

async function share() {
  if (busy.value) return
  busy.value = true
  notice.value = ''
  try {
    if (!prepared.value) {
      const response = await fetch(props.src, { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw new Error('Image unavailable')
      const blob = await response.blob()
      if (disposed) return
      const file = new File([blob], name.value, { type: blob.type })
      if (!navigator.canShare?.({ files: [file] })) {
        supported.value = false
        notice.value = 'Sharing this image is unavailable. Use Download instead.'
        return
      }
      prepared.value = file
      // Loading a large original can outlast the browser's user activation.
      if (!navigator.userActivation?.isActive) {
        notice.value = 'Image ready. Tap Share again to choose an app.'
        return
      }
    }
    await navigator.share({ files: [prepared.value!] })
    if (!disposed) prepared.value = null
  } catch (error) {
    if (disposed || (error as Error).name === 'AbortError') return
    notice.value = (error as Error).name === 'NotAllowedError' && prepared.value
      ? 'Tap Share again to choose an app, or use Download.'
      : 'Could not share this image. Try again or use Download.'
  } finally { if (!disposed) busy.value = false }
}
</script>

<template>
  <div class="fileActions" role="group" aria-label="Image file">
    <a :href="src" :download="name" data-viewer-focus="download">Download</a>
    <button v-if="supported" type="button" :disabled="busy" data-viewer-focus="share" @click="share">
      {{ busy ? 'Preparing…' : prepared ? 'Share image' : 'Share' }}
    </button>
    <p v-if="notice" role="status">{{ notice }}</p>
  </div>
</template>

<style scoped>
.fileActions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; }
a, button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 8px 14px; border: 0; border-radius: var(--radius-md); background: var(--color-secondary-bg, #e5e5e0); color: var(--color-ink); font: inherit; font-size: 14px; font-weight: 700; text-decoration: none; }
a:active, button:active { background: var(--color-secondary-pressed); }
button:disabled { opacity: .6; }
p { flex-basis: 100%; margin: 0; max-width: 32ch; color: var(--color-mute); font-size: 14px; line-height: 1.4; text-align: center; }
</style>
