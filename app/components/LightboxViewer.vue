<script setup lang="ts">
import styles from './LightboxViewer.module.css'
import { sharedTagCaption } from '../utils/related-images'
import type { ViewerHistoryEntry, ViewerPosition } from '../utils/viewer-history'

type ImageRecord = {
  id: string
  filename: string
  originalName: string | null
  mimeType: string
  sizeBytes: number
  createdAt: string
  src: string
  tags: ImageTag[]
}

type ImageTag = {
  id: string
  name: string
  normalizedName: string
}

type TagSummary = ImageTag & {
  imageCount: number
  lastUsedAt: string
}

const props = defineProps<{
  image: ImageRecord
  relatedImages: ImageRecord[]
  hasPrevious: boolean
  hasNext: boolean
  libraryTags: TagSummary[]
  filterNotice: string
  canGoBack: boolean
  tagsBusy: boolean
  saveTags: (id: string, tags: string[]) => Promise<ImageTag[]>
  restoration: (ViewerHistoryEntry & { token: number }) | null
}>()

const emit = defineEmits<{
  close: []
  openRelated: [id: string, position: ViewerPosition]
  previous: [position: ViewerPosition]
  next: [position: ViewerPosition]
  back: []
  filterTag: [tag: ImageTag]
}>()

const viewer = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const tagInput = ref<HTMLInputElement | null>(null)
const tagsPanel = ref<HTMLElement | null>(null)
const tagsButton = ref<HTMLButtonElement | null>(null)
const editingTags = ref(false)
const relatedButton = ref<HTMLButtonElement | null>(null)
const relatedSection = ref<HTMLElement | null>(null)
const relatedHeading = ref<HTMLHeadingElement | null>(null)
const announcement = ref('')
const backButton = ref<HTMLButtonElement | null>(null)
const imageDimensions = reactive(new Map<string, { width: number; height: number }>())
let disposed = false
let restorationVersion = 0
let stopRestoration: (() => void) | undefined
const rememberDimensions = (event: Event) => {
  const image = event.target as HTMLImageElement
  if (image.naturalWidth && image.naturalHeight) {
    imageDimensions.set(image.getAttribute('src')!, { width: image.naturalWidth, height: image.naturalHeight })
  }
}
const capturePosition = (focus?: string): ViewerPosition => ({
  scrollTop: viewer.value?.scrollTop ?? 0,
  focus: focus ?? (document.activeElement instanceof HTMLElement ? document.activeElement.dataset.viewerFocus ?? null : null),
})
const previousImage = () => {
  if (!savingTags.value && props.hasPrevious) emit('previous', capturePosition())
}
const nextImage = () => {
  if (!savingTags.value && props.hasNext) emit('next', capturePosition())
}
const goBack = () => {
  if (!savingTags.value && props.canGoBack) emit('back')
}

const scrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' as const : 'smooth' as const
const exploreTags = async () => {
  await nextTick()
  tagsPanel.value?.scrollIntoView({ block: 'start', behavior: scrollBehavior() })
  tagsPanel.value?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
}
const exploreRelated = async (event: MouseEvent) => {
  await nextTick()
  const destination = event.detail === 0 ? relatedHeading.value : relatedSection.value
  destination?.focus({ preventScroll: true })
  relatedSection.value?.scrollIntoView({ block: 'start', behavior: scrollBehavior() })
}
const returnToImage = () => {
  relatedButton.value?.focus({ preventScroll: true })
  viewer.value?.scrollTo({ top: 0, behavior: scrollBehavior() })
}
const openRelated = (id: string) => {
  if (!savingTags.value) emit('openRelated', id, capturePosition(`related:${id}`))
}
const draftTags = ref<ImageTag[]>([])
const pendingTag = ref('')
const tagError = ref('')
const submittingTags = ref(false)
const savingTags = computed(() => submittingTags.value || props.tagsBusy)
let previousBodyOverflow = ''

const normalizeTag = (value: string) => {
  const name = value.trim().replace(/\s+/g, ' ')

  return {
    name,
    normalizedName: name.toLowerCase(),
  }
}

const availableSuggestions = computed(() => {
  const used = new Set(draftTags.value.map((tag) => tag.normalizedName))
  const query = normalizeTag(pendingTag.value).normalizedName

  return props.libraryTags
    .filter((tag) => !used.has(tag.normalizedName))
    .filter((tag) => !query || tag.normalizedName.includes(query))
    .slice(0, 5)
})

const focusableControls = () => {
  if (!viewer.value) {
    return []
  }

  return Array.from(viewer.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'))
}

const isTagEditorTarget = (target: EventTarget | null) => {
  return target instanceof HTMLElement && Boolean(target.closest('[data-tag-editor="true"]'))
}

const handleKeydown = (event: KeyboardEvent) => {
  const target = event.target
  const isEditingTagControl = editingTags.value && isTagEditorTarget(target)
  const shouldKeepNavigationInEditor = target instanceof HTMLInputElement || isEditingTagControl
    || (target instanceof HTMLElement && Boolean(target.closest('[data-related-images]')))
    || savingTags.value

  if (event.key === 'Escape') {
    event.preventDefault()
    if (editingTags.value) {
      stopEditingTags()
    } else {
      emit('close')
    }
  }

  if (!shouldKeepNavigationInEditor && event.key === 'ArrowLeft') {
    event.preventDefault()
    previousImage()
  }

  if (!shouldKeepNavigationInEditor && event.key === 'ArrowRight') {
    event.preventDefault()
    nextImage()
  }

  if (event.key === 'Tab') {
    const controls = focusableControls()

    if (controls.length === 0) {
      event.preventDefault()
      return
    }

    const firstControl = controls[0]
    const lastControl = controls[controls.length - 1]

    if (event.shiftKey && (document.activeElement === firstControl || document.activeElement === relatedHeading.value || document.activeElement === relatedSection.value)) {
      event.preventDefault()
      lastControl?.focus()
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault()
      firstControl?.focus()
    }
  }
}

const syncDraftTags = () => {
  draftTags.value = [...props.image.tags]
  pendingTag.value = ''
  tagError.value = ''
}

const startEditingTags = async () => {
  editingTags.value = true
  syncDraftTags()
  await nextTick()
  tagInput.value?.focus()
}

const stopEditingTags = () => {
  editingTags.value = false
  syncDraftTags()
}

const saveDraftTags = async () => {
  if (savingTags.value) return
  const imageId = props.image.id
  submittingTags.value = true

  try {
    const tags = await props.saveTags(imageId, draftTags.value.map((tag) => tag.name))
    if (!disposed && props.image.id === imageId) {
      draftTags.value = tags
      tagError.value = ''
    }
  } catch (error) {
    if (disposed || props.image.id !== imageId) return
    const statusMessage = (error as { data?: { statusMessage?: string } }).data?.statusMessage
    tagError.value = statusMessage?.startsWith('Too many tags')
      ? 'Too many tags'
      : statusMessage?.startsWith('Tag is too long')
        ? 'Tag is too long'
        : 'Could not save tags'
  } finally {
    submittingTags.value = false
  }
}

const addDraftTag = async (value = pendingTag.value) => {
  if (savingTags.value) return
  const tag = normalizeTag(value)

  if (!tag.normalizedName) {
    pendingTag.value = ''
    return
  }

  if (tag.name.length > 48) {
    tagError.value = 'Tag is too long'
    return
  }

  if (draftTags.value.length >= 8) {
    tagError.value = 'Too many tags'
    return
  }

  if (draftTags.value.some((draftTag) => draftTag.normalizedName === tag.normalizedName)) {
    pendingTag.value = ''
    tagError.value = ''
    return
  }

  const existing = props.libraryTags.find((libraryTag) => libraryTag.normalizedName === tag.normalizedName)

  draftTags.value = [
    ...draftTags.value,
    existing ?? {
      id: `draft-${tag.normalizedName}`,
      name: tag.name,
      normalizedName: tag.normalizedName,
    },
  ]
  pendingTag.value = ''
  tagError.value = ''
  await saveDraftTags()
}

const removeDraftTag = async (normalizedName: string) => {
  if (savingTags.value) return
  draftTags.value = draftTags.value.filter((tag) => tag.normalizedName !== normalizedName)
  await saveDraftTags()
  await nextTick()
  tagInput.value?.focus()
}

onMounted(async () => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', handleKeydown)

  await nextTick()
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  disposed = true
  restorationVersion += 1
  stopRestoration?.()
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', handleKeydown)
})

watch([() => props.image.id, () => props.restoration?.token], async ([imageId]) => {
  const version = ++restorationVersion
  stopRestoration?.()
  editingTags.value = false
  syncDraftTags()
  const restoration = props.restoration?.imageId === imageId ? props.restoration : null
  await nextTick()
  if (disposed || version !== restorationVersion) return
  announcement.value = `Opened ${props.image.originalName || 'saved image'}`
  if (!restoration || !viewer.value) {
    viewer.value?.scrollTo({ top: 0, behavior: 'instant' })
    ;(relatedButton.value ?? tagsButton.value ?? closeButton.value)?.focus({ preventScroll: true })
    return
  }

  const container = viewer.value
  const restoreScroll = () => {
    if (!disposed && version === restorationVersion) container.scrollTo({ top: restoration.scrollTop, behavior: 'instant' })
  }
  const target = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-viewer-focus]:not(:disabled)'))
    .find((control) => control.dataset.viewerFocus === restoration.focus)
  ;(target ?? backButton.value ?? relatedButton.value ?? tagsButton.value ?? closeButton.value)?.focus({ preventScroll: true })
  restoreScroll()

  // Correct lazy-image layout shifts briefly; user input always takes over.
  const observer = new ResizeObserver(restoreScroll)
  if (relatedSection.value) observer.observe(relatedSection.value)
  if (tagsPanel.value) observer.observe(tagsPanel.value)
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
  const finish = () => {
    observer.disconnect()
    clearTimeout(timer)
    for (const event of events) container.removeEventListener(event, finish)
    if (stopRestoration === finish) stopRestoration = undefined
  }
  const timer = setTimeout(finish, 2000)
  for (const event of events) container.addEventListener(event, finish, { passive: true })
  stopRestoration = finish
})

watch(() => props.relatedImages, async (images) => {
  if (images.length) return
  const lostFocus = document.activeElement === relatedButton.value
    || Boolean(relatedSection.value?.contains(document.activeElement))
  if (lostFocus) {
    await nextTick()
    closeButton.value?.focus({ preventScroll: true })
  }
}, { flush: 'pre' })

watch(() => props.image.tags, () => {
  if (!editingTags.value) {
    syncDraftTags()
  }
})

syncDraftTags()
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
      data-viewer-focus="close"
      @click="$emit('close')"
    >
      <span aria-hidden="true">×</span>
    </button>

    <button
      v-if="canGoBack"
      ref="backButton"
      :class="[styles.returnButton, styles.backButton]"
      type="button"
      aria-label="Back to previous viewed image"
      data-viewer-focus="back"
      :disabled="savingTags"
      @click="goBack"
    ><span aria-hidden="true">←</span> Back</button>

    <div :class="styles.mainView">
      <div :class="styles.viewingHeader" aria-hidden="true" />
      <div :class="styles.imageStage" @click.self="$emit('close')">
        <img
          :class="styles.image"
          :src="image.src"
          :alt="image.originalName || 'Saved image'"
        >
      </div>
      <div :class="styles.viewingFooter">
        <div :class="styles.adjacentNavigation" role="group" aria-label="Browse images">
          <button
            :class="[styles.control, styles.navButton, styles.previousButton]"
            type="button"
            aria-label="Previous image"
            data-viewer-focus="previous"
            :disabled="!hasPrevious || savingTags"
            @click="previousImage"
          >
            <span aria-hidden="true">‹</span>
          </button>

          <button
            :class="[styles.control, styles.navButton, styles.nextButton]"
            type="button"
            aria-label="Next image"
            data-viewer-focus="next"
            :disabled="!hasNext || savingTags"
            @click="nextImage"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
        <button
          v-if="!editingTags && !relatedImages.length"
          ref="tagsButton"
          type="button"
          :class="[styles.exploreButton, styles.tagsHint]"
          :disabled="savingTags"
          aria-controls="viewer-tags"
          data-viewer-focus="tags"
          @click="exploreTags"
        >Tags <span aria-hidden="true">↓</span></button>
        <button
          v-if="!editingTags && relatedImages.length"
          ref="relatedButton"
          type="button"
          :class="styles.exploreButton"
          :disabled="savingTags"
          aria-controls="related-images"
          data-viewer-focus="explore"
          @click="exploreRelated"
        >Explore related <span aria-hidden="true">↓</span></button>
      </div>
    </div>

    <div id="viewer-tags" ref="tagsPanel" :class="styles.tagsPanel">
      <div
        v-if="!editingTags"
        :class="styles.tagList"
      >
        <button
          v-for="tag in image.tags"
          :key="tag.id"
          :class="styles.tagChip"
          type="button"
          :disabled="savingTags"
          :aria-label="`Filter by ${tag.name}`"
          @click="$emit('filterTag', tag)"
        >
          {{ tag.name }}
        </button>

        <button
          :class="styles.addTagButton"
          type="button"
          aria-label="Add or edit tags"
          :disabled="savingTags"
          @click="startEditingTags"
        >
          {{ image.tags.length === 0 ? '+ Add tag' : '+' }}
        </button>


        <p
          v-if="filterNotice"
          :class="styles.filterNotice"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ filterNotice }}
        </p>
      </div>

      <form
        v-else
        :class="styles.tagEditor"
        data-tag-editor="true"
        @submit.prevent="addDraftTag()"
      >
        <div :class="styles.editChips">
          <button
            v-for="tag in draftTags"
            :key="tag.normalizedName"
            :class="styles.editChip"
            type="button"
            :disabled="savingTags"
            :aria-label="`Remove ${tag.name}`"
            @click="removeDraftTag(tag.normalizedName)"
          >
            {{ tag.name }}
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <input
          ref="tagInput"
          v-model="pendingTag"
          :class="styles.tagInput"
          type="text"
          maxlength="56"
          placeholder="Add tag"
          aria-label="Tag to add to this image"
          :disabled="savingTags"
        >

        <div
          v-if="availableSuggestions.length > 0 && pendingTag"
          :class="styles.suggestions"
        >
          <button
            v-for="tag in availableSuggestions"
            :key="tag.id"
            :class="styles.suggestion"
            type="button"
            :disabled="savingTags"
            @click="addDraftTag(tag.name)"
          >
            {{ tag.name }}
          </button>
        </div>

        <p
          v-if="tagError"
          :class="styles.tagError"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ tagError }}
        </p>

        <button
          :class="styles.doneButton"
          type="button"
          @click="editingTags = false"
        >
          Done
        </button>
      </form>
    </div>

    <section
      v-if="!editingTags && relatedImages.length"
      id="related-images"
      ref="relatedSection"
      data-related-images
      tabindex="-1"
      :class="[styles.relatedSection, { [styles.singleRelated]: relatedImages.length === 1, [styles.pairRelated]: relatedImages.length === 2 }]"
      aria-labelledby="related-heading"
    >
      <div :class="styles.relatedHeader">
        <div>
          <h2 id="related-heading" ref="relatedHeading" tabindex="-1">Related images</h2>
          <p :class="styles.relatedContext">Shared tags · Entire library</p>
        </div>
        <button type="button" :class="styles.returnButton" data-viewer-focus="main-image" @click="returnToImage"><span aria-hidden="true">↑</span> Back to main image</button>
      </div>
      <div :class="styles.relatedGrid">
        <button
          v-for="related in relatedImages"
          data-related-card
          :data-viewer-focus="`related:${related.id}`"
          :key="related.id"
          type="button"
          :class="styles.relatedCard"
          :disabled="savingTags"
          :aria-label="`Open related image ${related.originalName || 'saved image'}. ${sharedTagCaption(image, related)}`"
          @click="openRelated(related.id)"
        >
          <img
            :src="related.src" :alt="related.originalName || 'Saved image'"
            :width="imageDimensions.get(related.src)?.width"
            :height="imageDimensions.get(related.src)?.height"
            :loading="restoration?.imageId === image.id ? 'eager' : 'lazy'"
            @load="rememberDimensions"
          >
          <span :class="styles.connectionCaption">{{ sharedTagCaption(image, related) }}</span>
        </button>
      </div>
    </section>
    <p :class="styles.screenReaderOnly" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </section>
</template>
