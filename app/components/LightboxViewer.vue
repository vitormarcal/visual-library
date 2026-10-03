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
}>()

const emit = defineEmits<{
  close: []
  openRelated: [id: string]
  previous: []
  next: []
  filterTag: [tag: ImageTag]
  tagsUpdated: [id: string, tags: ImageTag[]]
}>()

const viewer = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const tagInput = ref<HTMLInputElement | null>(null)
const editingTags = ref(false)
const relatedButton = ref<HTMLButtonElement | null>(null)
const relatedSection = ref<HTMLElement | null>(null)
const relatedHeading = ref<HTMLHeadingElement | null>(null)
const announcement = ref('')
const scrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' as const : 'smooth' as const
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
  if (!savingTags.value) emit('openRelated', id)
}
const draftTags = ref<ImageTag[]>([])
const pendingTag = ref('')
const tagError = ref('')
const savingTags = ref(false)
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
    emit('previous')
  }

  if (!shouldKeepNavigationInEditor && event.key === 'ArrowRight') {
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
  savingTags.value = true

  try {
    const response = await $fetch<{ tags: ImageTag[] }>(`/api/images/${imageId}/tags`, {
      method: 'PUT',
      body: {
        tags: draftTags.value.map((tag) => tag.name),
      },
    })

    emit('tagsUpdated', imageId, response.tags)
    if (props.image.id === imageId) {
      draftTags.value = response.tags
      tagError.value = ''
    }
  } catch (error) {
    if (props.image.id !== imageId) return
    const statusMessage = (error as { data?: { statusMessage?: string } }).data?.statusMessage
    tagError.value = statusMessage?.startsWith('Too many tags')
      ? 'Too many tags'
      : statusMessage?.startsWith('Tag is too long')
        ? 'Tag is too long'
        : 'Could not save tags'
  } finally {
    savingTags.value = false
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
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => props.image.id, async () => {
  editingTags.value = false
  syncDraftTags()
  await nextTick()
  viewer.value?.scrollTo({ top: 0 })
  announcement.value = `Opened ${props.image.originalName || 'saved image'}`
  ;(relatedButton.value ?? closeButton.value)?.focus({ preventScroll: true })
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
      @click="$emit('close')"
    >
      <span aria-hidden="true">×</span>
    </button>

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
            :disabled="!hasPrevious || savingTags"
            @click="$emit('previous')"
          >
            <span aria-hidden="true">‹</span>
          </button>

          <button
            :class="[styles.control, styles.navButton, styles.nextButton]"
            type="button"
            aria-label="Next image"
            :disabled="!hasNext || savingTags"
            @click="$emit('next')"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
        <button
          v-if="!editingTags && relatedImages.length"
          ref="relatedButton"
          type="button"
          :class="styles.exploreButton"
          :disabled="savingTags"
          aria-controls="related-images"
          @click="exploreRelated"
        >Explore related <span aria-hidden="true">↓</span></button>
      </div>
    </div>

    <div :class="styles.tagsPanel">
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
          <p :class="styles.relatedContext">Shared tags · Current view</p>
        </div>
        <button type="button" :class="styles.returnButton" @click="returnToImage"><span aria-hidden="true">↑</span> Back to image</button>
      </div>
      <div :class="styles.relatedGrid">
        <button
          v-for="related in relatedImages"
          data-related-card
          :key="related.id"
          type="button"
          :class="styles.relatedCard"
          :disabled="savingTags"
          :aria-label="`Open related image ${related.originalName || 'saved image'}`"
          @click="openRelated(related.id)"
        ><img :src="related.src" :alt="related.originalName || 'Saved image'" loading="lazy"></button>
      </div>
    </section>
    <p :class="styles.screenReaderOnly" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </section>
</template>
