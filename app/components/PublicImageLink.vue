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
  <section class="publicLink" aria-label="Public sharing" :aria-busy="busy">
    <div class="heading">
      <h3>Public link</h3>
      <span class="sharingState">{{ !loaded ? (busy ? 'Checking…' : 'Unavailable') : url ? 'Link active' : 'Not shared' }}</span>
    </div>
    <p>{{ url ? 'Anyone with this link can view this image.' : 'Create a link to share this image with anyone.' }}</p>
    <p v-if="count > 1">{{ count }} active links share this image. Revoking disables all of them.</p>
    <div class="linkActions">
      <input v-if="url" :value="url" readonly aria-label="Public image link" @focus="($event.target as HTMLInputElement).select()">
      <button class="copyButton" type="button" :disabled="busy || !loaded" @click="copy">{{ busy && loaded ? 'Working…' : url ? 'Copy link' : 'Create & copy link' }}</button>
    </div>
    <button v-if="url" class="revokeButton" type="button" :disabled="busy" @click="revoke">{{ count > 1 ? 'Revoke all links' : 'Revoke link' }}</button>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
  </section>
</template>

<style scoped>
.publicLink { min-width: 0; padding: 20px 0; border-top: 1px solid var(--color-hairline); border-bottom: 1px solid var(--color-hairline); }
.heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
h3 { margin: 0; color: var(--color-ink); font-size: 14px; font-weight: 700; line-height: 1.4; }
.sharingState { color: var(--color-mute); font-size: 12px; }
p { margin: 6px 0 12px; color: var(--color-mute); font-size: 14px; line-height: 1.5; }
.linkActions { display: flex; flex-wrap: wrap; gap: 8px; }
button { min-height: 44px; border: 0; border-radius: var(--radius-md); padding: 10px 16px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.copyButton { background: var(--color-secondary-bg); color: var(--color-ink); }
.copyButton:active { background: var(--color-secondary-pressed); }
.revokeButton { margin-top: 8px; padding-inline: 8px; background: transparent; color: var(--color-mute); font-weight: 400; text-decoration: underline; text-underline-offset: 3px; }
button:disabled { opacity: .55; cursor: default; }
input { flex: 1 1 180px; width: 0; min-width: 0; min-height: 44px; border: 1px solid var(--color-hairline); border-radius: var(--radius-md); padding: 10px 12px; background: var(--color-canvas); color: var(--color-body); font: inherit; font-size: 16px; }
.notice { margin: 10px 0 0; color: var(--color-ink); overflow-wrap: anywhere; }
@media (max-width: 400px) { .linkActions input { flex-basis: 100%; width: 100%; } .copyButton { width: 100%; } }
</style>
