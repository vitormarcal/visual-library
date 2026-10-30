<script setup lang="ts">
const props = defineProps<{ imageId: string }>()
const { $libraryApi } = useNuxtApp()
const count = ref(0)
const url = ref<string | null>(null), busy = ref(true), notice = ref(''), loaded = ref(false)
let revision = 0
watch(() => props.imageId, async id => {
  const current = ++revision
  url.value = null; count.value = 0; notice.value = ''; busy.value = true; loaded.value = false
  try {
    const result = await $libraryApi<{ url: string | null; count: number }>(`/api/images/${encodeURIComponent(id)}/public-link`)
    if (current === revision) { url.value = result.url; count.value = result.count; loaded.value = true }
  } catch { if (current === revision) notice.value = 'Could not check sharing. Reopen this image to retry.' }
  finally { if (current === revision) busy.value = false }
}, { immediate: true })
onBeforeUnmount(() => { revision++ })
async function copy() {
  const current = revision, id = props.imageId
  busy.value = true; notice.value = ''
  try {
    const result = await $libraryApi<{ url: string; count: number }>(`/api/images/${encodeURIComponent(id)}/public-link`, { method: 'POST' })
    if (current !== revision) return
    url.value = result.url; count.value = result.count
    try {
      await navigator.clipboard.writeText(result.url)
      if (current === revision) notice.value = 'Public link copied.'
    } catch { if (current === revision) notice.value = 'Select and copy the public link below.' }
  } catch { if (current === revision) notice.value = 'Could not create the link. Try again.' }
  finally { if (current === revision) busy.value = false }
}
async function revoke() {
  const current = revision, id = props.imageId
  busy.value = true; notice.value = ''
  try {
    await $libraryApi(`/api/images/${encodeURIComponent(id)}/public-link`, { method: 'DELETE' })
    if (current === revision) { url.value = null; count.value = 0; notice.value = 'Public link revoked. Downloaded copies may remain.' }
  } catch { if (current === revision) notice.value = 'Could not revoke the link. Try again.' }
  finally { if (current === revision) busy.value = false }
}
</script>

<template>
  <div class="publicLink">
    <p>Anyone with a public link can view this image.</p>
    <p v-if="count > 1">{{ count }} active public links. All show this image.</p>
    <button type="button" :disabled="busy || !loaded" @click="copy">{{ url ? 'Copy public link' : 'Create and copy public link' }}</button>
    <button v-if="url" type="button" :disabled="busy" @click="revoke">{{ count > 1 ? 'Revoke all public links' : 'Revoke public link' }}</button>
    <input v-if="url" :value="url" readonly aria-label="Public image link" @focus="($event.target as HTMLInputElement).select()">
    <p v-if="notice" role="status">{{ notice }}</p>
  </div>
</template>

<style scoped>
.publicLink { margin: 16px 0; max-width: 100%; }
p { color: var(--color-mute); font-size: 14px; line-height: 1.5; }
button { border: 0; border-radius: var(--radius-full); background: var(--color-surface-card); padding: 10px 14px; margin: 0 8px 8px 0; color: var(--color-ink); }
input { display: block; width: 100%; min-width: 0; border: 1px solid var(--color-hairline); border-radius: var(--radius-md); padding: 10px; }
</style>
