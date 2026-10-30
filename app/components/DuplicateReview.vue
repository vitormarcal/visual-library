<script setup lang="ts">
import { interceptLibraryLink } from '../utils/library-navigation'
import { suggestedDuplicateKeeps, duplicateSuggestionReason, type DuplicateGroup, type DuplicateReviewResponse } from '../utils/duplicate-review'
import type { ImageRecord } from '../types/image'
const props = defineProps<{ groupId: string | null; broad: boolean; backHref: string; applyResolution: (result: { removedIds: string[]; images: ImageRecord[] }) => void }>()
const emit = defineEmits<{ group: [id: string | null]; mode: [broad: boolean]; back: [] }>()
const { $libraryApi } = useNuxtApp()
const status = ref<DuplicateReviewResponse | null>(null), loading = ref(true), busy = ref(false), error = ref(''), notice = ref('')
const skipped = ref(new Set<string>()), confirming = ref(false), showTags = ref(false)
const kept = ref<string[]>([]), targetId = ref<string | null>(null)
const zoom = ref<HTMLDialogElement | null>(null), zoomIndex = ref<number | null>(null)
const heading = ref<HTMLElement | null>(null), confirmation = ref<HTMLElement | null>(null), reviewButton = ref<HTMLButtonElement | null>(null)
const drafts = new Map<string, { revision: string; kept: string[]; target: string | null }>()
let version = 0, timer: ReturnType<typeof setTimeout> | undefined, disposed = false
const groups = computed(() => status.value?.groups ?? [])
const current = computed(() => props.groupId ? groups.value.find(group => group.id === props.groupId) ?? null : groups.value.find(group => !skipped.value.has(group.id)) ?? null)
const selected = computed(() => current.value?.images.filter(image => kept.value.includes(image.id)) ?? [])
const removed = computed(() => current.value?.images.filter(image => !kept.value.includes(image.id)) ?? [])
const needsTarget = computed(() => removed.value.some(image => image.tags.length || image.publicLinkCount))
const destination = computed(() => selected.value.find(image => image.id === targetId.value) ?? (!needsTarget.value ? selected.value[0] ?? null : null))
const transferLinks = computed(() => removed.value.reduce((count, image) => count + image.publicLinkCount, 0))
const preservedTags = computed(() => {
  if (!destination.value || !removed.value.length) return []
  const tags = new Map(destination.value.tags.map(tag => [tag.normalizedName, { ...tag, added: false }]))
  for (const image of removed.value) for (const tag of image.tags) if (!tags.has(tag.normalizedName)) tags.set(tag.normalizedName, { ...tag, added: true })
  return [...tags.values()]
})
const canRemove = computed(() => selected.value.length > 0 && removed.value.length > 0 && Boolean(destination.value) && !removed.value.some(image => image.integrationReferenceCount))
const suggestions = computed(() => current.value ? suggestedDuplicateKeeps(current.value.images, props.broad) : [])
const zoomImage = computed(() => zoomIndex.value === null ? null : current.value?.images[zoomIndex.value] ?? null)
const draftKey = (group: DuplicateGroup) => `${props.broad}:${group.id}`
function remember() {
  if (current.value) drafts.set(draftKey(current.value), { revision: current.value.revision, kept: [...kept.value], target: targetId.value })
}
function alignTarget() {
  if (selected.value.length === 1) targetId.value = selected.value[0]!.id
  else if (!selected.value.some(image => image.id === targetId.value)) targetId.value = null
}
function reset() {
  if (!current.value) return
  kept.value = suggestedDuplicateKeeps(current.value.images, props.broad)
  targetId.value = kept.value.length === 1 ? kept.value[0]! : null
  confirming.value = false; remember()
}
watch(() => current.value ? `${current.value.id}:${current.value.revision}:${props.broad}` : null, () => {
  confirming.value = false; showTags.value = false; closeZoom()
  if (!current.value) return
  const draft = drafts.get(draftKey(current.value))
  if (draft?.revision === current.value.revision) { kept.value = [...draft.kept]; targetId.value = draft.target }
  else reset()
  if (!props.groupId) emit('group', current.value.id)
}, { immediate: true })
function choose(id: string, keep: boolean) {
  if (busy.value || !current.value) return
  const image = current.value.images.find(image => image.id === id)
  if (!keep && image?.integrationReferenceCount) return
  kept.value = keep ? [...new Set([...kept.value, id])] : kept.value.filter(value => value !== id)
  alignTarget(); confirming.value = false; remember()
}
function chooseDestination(id: string) { targetId.value = id; confirming.value = false; remember() }
async function load() {
  const request = ++version
  if (timer) clearTimeout(timer)
  loading.value = true; error.value = ''
  try {
    const result = await $libraryApi<DuplicateReviewResponse>(`/api/duplicates?mode=${props.broad ? 'broad' : 'likely'}`)
    if (disposed || request !== version) return
    status.value = result
    if (result.state === 'preparing') timer = setTimeout(() => { void load() }, 2000)
  } catch { if (!disposed && request === version) error.value = 'Could not load the review. Try again.' }
  finally { if (!disposed && request === version) loading.value = false }
}
async function prepare() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { await $libraryApi('/api/duplicates/prepare', { method: 'POST' }); await load() }
  catch { if (!disposed) error.value = 'Could not prepare duplicate review. Try again.' }
  finally { if (!disposed) busy.value = false }
}
async function focusGroup() { await nextTick(); heading.value?.focus({ preventScroll: true }); heading.value?.scrollIntoView({ block: 'start', behavior: 'instant' }) }
function nextGroup() {
  const next = groups.value.find(group => !skipped.value.has(group.id))
  emit('group', next?.id ?? null)
  void focusGroup()
}
function skip() {
  if (!current.value || busy.value) return
  remember(); skipped.value = new Set([...skipped.value, current.value.id]); notice.value = 'Skipped for now.'; nextGroup()
}
async function resolve(keepAll = false) {
  const group = current.value
  if (!group || busy.value || (!keepAll && (!canRemove.value || !confirming.value))) return
  busy.value = true; error.value = ''
  try {
    const result = await $libraryApi<{ removedIds: string[]; images: ImageRecord[] }>('/api/duplicates/resolve', {
      method: 'POST', body: { groupId: group.id, revision: group.revision, keepIds: keepAll ? group.images.map(image => image.id) : kept.value,
        targetId: keepAll ? null : targetId.value, broad: props.broad },
    })
    // A completed mutation must reach the parent even if the user changed context meanwhile.
    props.applyResolution(result)
    if (disposed) return
    status.value!.groups = groups.value.filter(item => item.id !== group.id)
    confirming.value = false
    notice.value = result.removedIds.length ? `${result.removedIds.length} images removed · tags and public links preserved.` : 'All images kept.'
    nextGroup()
  } catch (cause) {
    if (disposed) return
    const code = (cause as { statusCode?: number }).statusCode
    confirming.value = false
    if (code === 409) { await load(); error.value = 'This group changed. Review the current images and confirm again.' }
    else error.value = 'Could not apply the review. Your choices are still here; refresh before retrying if the connection was interrupted.'
  } finally { if (!disposed) busy.value = false }
}
async function confirm() {
  if (!canRemove.value || busy.value) return
  confirming.value = true; await nextTick(); confirmation.value?.focus({ preventScroll: true }); confirmation.value?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
}
async function enlarge(index: number) {
  zoomIndex.value = index; await nextTick(); zoom.value?.showModal()
  if (import.meta.client) document.body.style.overflow = 'hidden'
}
function closeZoom() {
  zoom.value?.close(); zoomIndex.value = null
  if (import.meta.client) document.body.style.overflow = ''
}
watch(() => props.broad, () => { confirming.value = false; skipped.value = new Set(); status.value = null; void load() })
onMounted(() => { void load() })
onBeforeUnmount(() => { disposed = true; version++; if (timer) clearTimeout(timer); closeZoom() })
const formatSize = (bytes: number) => `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(bytes / 1_000_000)} MB`
</script>

<template>
  <section class="duplicateReview" aria-label="Review duplicate images">
    <div class="reviewNav">
      <a :href="backHref" @click="event => { if (interceptLibraryLink(event)) emit('back') }">← Back to Library</a>
      <label>Review <select :value="broad ? 'broad' : 'likely'" :disabled="busy" @change="emit('mode', ($event.target as HTMLSelectElement).value === 'broad')"><option value="likely">Likely copies</option><option value="broad">Broader review</option></select></label>
    </div>
    <p class="explanation">Compare before removing. Suggestions use resolution and file size; they cannot judge image quality or differences in expression and pose.</p>
    <p v-if="broad" class="explanation">Broader review may include different images. Everything starts marked to keep.</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error" role="alert">{{ error }} <button type="button" :disabled="busy" @click="load">Refresh review</button></p>
    <p v-if="loading && !status">Loading review.</p>
    <div v-else-if="status?.state === 'inactive'" class="reviewState">
      <p>Prepare your visible images once to find possible copies. The first preparation downloads a model (about 372 MB). Images are processed on your server.</p>
      <button class="primary" type="button" :disabled="busy || !status.totalCount" @click="prepare">Prepare duplicate review</button>
    </div>
    <div v-else-if="status?.state === 'preparing'" class="reviewState" role="status">
      <p>Preparing images · {{ status.preparedCount }} of {{ status.totalCount }} ready. You can keep using the library.</p>
      <p v-if="status.failedCount">{{ status.failedCount }} could not be analyzed.</p>
    </div>
    <div v-else-if="status?.state === 'unavailable'" class="reviewState"><p>Duplicate review is temporarily unavailable.</p><button type="button" :disabled="busy" @click="prepare">Try again</button></div>
    <template v-else-if="status?.state === 'ready'">
      <p v-if="status.failedCount" class="explanation">{{ status.failedCount }} of {{ status.totalCount }} images could not be analyzed. Results cover prepared images only. <button type="button" :disabled="busy" @click="prepare">Retry failed images</button></p>
      <template v-if="current">
        <div class="groupHeader"><h2 ref="heading" tabindex="-1" data-duplicate-heading>{{ groups.findIndex(group => group.id === current!.id) + 1 }} of {{ groups.length }} groups · {{ current.images.length }} images</h2><button type="button" class="quiet" :disabled="busy" @click="reset">Reset suggestions</button></div>
        <div class="duplicateCards">
          <article v-for="(image, index) in current.images" :key="image.id" class="duplicateCard" :class="{ kept: kept.includes(image.id) }">
            <div class="cardLabel"><span>{{ suggestions.includes(image.id) && !broad ? 'Suggested to keep' : 'Possible copy' }}</span><span class="muted">{{ index + 1 }}</span></div>
            <div class="imageStage">
              <ProgressiveImage :src="image.thumbnailSrc || image.src" :alt="`Image ${index + 1} in this group`" :width="image.width" :height="image.height" />
              <button class="enlarge" type="button" :aria-label="`Enlarge image ${index + 1}`" @click="enlarge(index)"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" /></svg></button>
            </div>
            <div class="cardBody">
              <p class="reason">{{ duplicateSuggestionReason(image, current.images) }}</p>
              <p class="dimensions">{{ image.width && image.height ? `${image.width} × ${image.height}` : 'Dimensions unavailable' }} <span>· {{ formatSize(image.sizeBytes) }}</span></p>
              <p v-if="image.publicLinkCount" class="reason">{{ image.publicLinkCount }} active public {{ image.publicLinkCount === 1 ? 'link' : 'links' }}</p>
              <div class="decision" role="group" :aria-label="`Keep or remove image ${index + 1}`">
                <button type="button" :disabled="busy" :aria-pressed="kept.includes(image.id)" @click="choose(image.id, true)">{{ kept.includes(image.id) ? '✓ ' : '' }}Keep</button>
                <button type="button" :disabled="busy || Boolean(image.integrationReferenceCount)" :aria-pressed="!kept.includes(image.id)" @click="choose(image.id, false)">{{ !kept.includes(image.id) ? '− ' : '' }}Remove</button>
              </div>
              <label v-if="kept.includes(image.id) && selected.length > 1 && removed.length && needsTarget" class="destination"><input type="radio" name="duplicate-destination" :checked="targetId === image.id" :disabled="busy" @change="chooseDestination(image.id)">Receives tags and links</label>
              <details><summary>Name and tags</summary><p class="filename">{{ image.originalName || image.filename }}</p><div class="chips"><span v-for="tag in image.tags" :key="tag.id" class="chip">{{ tag.name }}</span></div></details>
            </div>
          </article>
        </div>
        <section class="preservation" aria-label="Tags and public links to preserve">
          <h3>Tags and links preserved</h3>
          <template v-if="removed.length && destination && needsTarget">
            <p>Tags from removed images will be added to image {{ current.images.findIndex(image => image.id === destination?.id) + 1 }}. Its existing tags will stay.</p>
            <div class="chips"><span v-for="tag in (showTags ? preservedTags : preservedTags.slice(0, 8))" :key="tag.id" class="chip" :class="{ added: tag.added }">{{ tag.added ? '+ ' : '' }}{{ tag.name }}</span></div>
            <button v-if="!showTags && preservedTags.length > 8" class="quiet" type="button" @click="showTags = true">Show all {{ preservedTags.length }} tags</button>
            <p class="caption">{{ preservedTags.filter(tag => tag.added).length }} added · {{ preservedTags.length }} tags after review</p>
            <p v-if="transferLinks">{{ transferLinks }} public {{ transferLinks === 1 ? 'link will' : 'links will' }} keep working and show image {{ current.images.findIndex(image => image.id === destination?.id) + 1 }}. Existing URLs will stay the same.</p>
          </template>
          <p v-else-if="removed.length && !needsTarget">The removed images have no tags or public links to transfer. Kept images will stay unchanged.</p>
          <p v-else-if="removed.length">{{ selected.length ? 'Choose a kept image to receive tags and public links. Other kept images keep their own tags and links.' : 'Keep at least one image before removing any copies.' }}</p>
          <p v-else>All images will stay. No tags or links will be transferred.</p>
        </section>
        <div class="reviewActions"><strong>Keep {{ selected.length }} · Remove {{ removed.length }}</strong><div><button type="button" class="quiet" :disabled="busy" @click="skip">Skip for now</button><button type="button" :disabled="busy" @click="resolve(true)">Keep all</button><button ref="reviewButton" class="primary" type="button" :disabled="busy || !canRemove" @click="confirm">Review removal</button></div></div>
        <section v-if="confirming" class="confirmation" aria-label="Confirm permanent removal">
          <h3 ref="confirmation" tabindex="-1">Remove {{ removed.length }} {{ removed.length === 1 ? 'image' : 'images' }} permanently?</h3>
          <p>{{ selected.length }} will stay. {{ preservedTags.filter(tag => tag.added).length }} tags and {{ transferLinks }} public links will be preserved in image {{ current.images.findIndex(image => image.id === destination?.id) + 1 }}. Removal cannot be undone.</p>
          <div class="confirmationActions"><button type="button" :disabled="busy" @click="confirming = false; reviewButton?.focus()">Cancel</button><button type="button" class="primary" :disabled="busy || !canRemove" @click="resolve()">{{ busy ? 'Applying…' : `Remove ${removed.length} ${removed.length === 1 ? 'image' : 'images'}` }}</button></div>
        </section>
      </template>
      <div v-else class="reviewState">
        <p>{{ groupId ? 'This group is no longer available.' : skipped.size ? 'No more groups in this pass. Skipped groups are still available.' : 'No unreviewed groups found among the prepared images.' }}</p>
        <button v-if="groupId || skipped.size" type="button" @click="skipped = new Set(); emit('group', groups[0]?.id ?? null)">Review available groups</button>
        <button v-else type="button" @click="load">Refresh review</button>
      </div>
    </template>
    <dialog ref="zoom" class="zoomDialog" aria-label="Compare enlarged images" @cancel.prevent="closeZoom" @keydown.esc.prevent.stop="closeZoom">
      <template v-if="zoomImage">
        <div class="zoomHeader"><span>{{ zoomImage.originalName || 'Saved image' }}</span><button type="button" @click="closeZoom">Close ×</button></div>
        <img class="zoomImage" :src="zoomImage.src" :alt="`Enlarged image ${zoomIndex! + 1}`">
        <div class="zoomNavigation"><button type="button" :disabled="zoomIndex === 0" @click="zoomIndex = (zoomIndex ?? 0) - 1">← Previous</button><span>{{ zoomIndex! + 1 }} of {{ current?.images.length }}</span><button type="button" :disabled="zoomIndex! === (current?.images.length ?? 0) - 1" @click="zoomIndex = (zoomIndex ?? 0) + 1">Next →</button></div>
      </template>
    </dialog>
  </section>
</template>

<style scoped>
.duplicateReview { margin: var(--space-xl) 0; }
button, a, select { min-height: 44px; border-radius: var(--radius-md); color: var(--color-ink); font: inherit; font-size: 14px; }
button { border: 0; padding: 10px 14px; background: var(--color-secondary-bg); font-weight: 700; }
button:active { background: var(--color-secondary-pressed); }
button:disabled { color: var(--color-ash); cursor: default; }
button.primary { background: var(--color-primary); color: var(--color-canvas); }
button.primary:active { background: var(--color-primary-pressed); }
button.primary:disabled { background: var(--color-surface-card); color: var(--color-ash); }
button.quiet { background: transparent; color: var(--color-mute); }
a { display: inline-flex; align-items: center; text-decoration: none; padding: 8px 0; }
select { border: 1px solid var(--color-hairline); background: var(--color-canvas); padding: 8px 12px; margin-left: 8px; }
button:focus-visible, select:focus-visible, input:focus-visible, summary:focus-visible, a:focus-visible { outline: 2px solid var(--color-focus-outer); outline-offset: 3px; }
.reviewNav, .groupHeader, .reviewActions, .zoomHeader, .zoomNavigation { display: flex; justify-content: space-between; align-items: center; gap: var(--space-lg); flex-wrap: wrap; }
.reviewNav label { font-size: 14px; color: var(--color-mute); }
.explanation, .reviewState p, .preservation p, .confirmation p { font-size: 14px; line-height: 1.5; color: var(--color-mute); }
.explanation { max-width: 760px; margin: 12px 0; }
.groupHeader { margin: var(--space-xl) 0 var(--space-lg); }
h2 { font-size: 18px; line-height: 1.3; font-weight: 600; margin: 0; }
h3 { font-size: 18px; line-height: 1.3; font-weight: 600; margin: 0 0 12px; }
.duplicateCards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: var(--space-lg); }
.duplicateCard { border: 1px solid var(--color-hairline); border-radius: var(--radius-md); padding: 8px; min-width: 0; }
.duplicateCard.kept { border: 2px solid var(--color-ink-soft); padding: 7px; }
.cardLabel { min-height: 40px; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 8px; font-size: 12px; font-weight: 600; }
.muted, .reason, .dimensions span { color: var(--color-mute); }
.imageStage { position: relative; height: min(52vh, 520px); background: var(--color-surface-card); border-radius: var(--radius-md); overflow: hidden; }
.imageStage :deep(.progressiveImage), .imageStage :deep(img) { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.enlarge { position: absolute; bottom: 8px; right: 8px; display: grid; place-items: center; min-width: 44px; border-radius: var(--radius-full); background: var(--color-canvas); }
.cardBody { padding: var(--space-lg) var(--space-sm) 6px; }
.reason { font-size: 14px; line-height: 1.4; min-height: 19px; margin: 0 0 8px; }
.dimensions { font-size: 14px; margin: 0 0 14px; }
.decision { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; background: var(--color-surface-card); border-radius: var(--radius-full); }
.decision button { border-radius: var(--radius-full); background: transparent; }
.decision button[aria-pressed=true] { background: var(--color-canvas); outline: 1px solid var(--color-hairline); outline-offset: -1px; }
.destination { display: flex; align-items: center; gap: 8px; font-size: 14px; min-height: 44px; margin-top: 8px; }
.destination input { accent-color: var(--color-ink); width: 18px; height: 18px; }
details { margin-top: 12px; font-size: 14px; color: var(--color-mute); }
summary { cursor: pointer; min-height: 32px; }
.filename { overflow-wrap: anywhere; }
.chips { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-top: 12px; }
.chip { background: var(--color-surface-card); padding: 6px 10px; border-radius: var(--radius-full); font-size: 12px; overflow-wrap: anywhere; max-width: 100%; }
.chip.added { background: var(--color-canvas); border: 1px solid var(--color-hairline); }
.preservation, .confirmation { padding: var(--space-xl); background: var(--color-surface-soft); border: 1px solid var(--color-hairline); border-radius: var(--radius-md); margin-top: var(--space-xl); }
.preservation p { margin: 8px 0; }
.preservation .caption { font-size: 12px; }
.reviewActions { margin: var(--space-xl) 0; }
.reviewActions strong { font-size: 14px; font-weight: 600; }
.reviewActions > div, .confirmationActions { display: flex; gap: var(--space-sm); flex-wrap: wrap; }
[role=alert] { color: var(--color-error); font-size: 14px; line-height: 1.5; }
[role=status] { color: var(--color-mute); font-size: 14px; line-height: 1.5; }
.zoomDialog { border: 0; padding: var(--space-xxl); border-radius: var(--radius-lg); width: min(1100px, 96vw); max-height: 96dvh; background: var(--color-canvas); }
.zoomDialog::backdrop { background: rgba(0,0,0,.7); }
.zoomHeader { font-size: 14px; }
.zoomHeader span { overflow-wrap: anywhere; min-width: 0; flex: 1; }
.zoomImage { display: block; width: 100%; height: 65dvh; object-fit: contain; margin: 16px 0; }
@media (max-width: 600px) { .duplicateCards { grid-template-columns: 1fr; } .imageStage { height: 390px; } .reviewActions { align-items: stretch; } .reviewActions > div { width: 100%; } .reviewActions .primary { width: 100%; } .zoomDialog { padding: 16px; } .reviewNav { align-items: flex-start; } }
</style>
