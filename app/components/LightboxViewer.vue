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
  hasPrevious: boolean
  hasNext: boolean
  libraryTags: TagSummary[]
  filterNotice: string
}>()

const emit = defineEmits<{
  close: []
  previous: []
  next: []
  filterTag: [tag: ImageTag]
  tagsUpdated: [id: string, tags: ImageTag[]]
}>()

const viewer = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const tagInput = ref<HTMLInputElement | null>(null)
const editingTags = ref(false)
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

  return Array.from(viewer.value.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
}

const handleKeydown = (event: KeyboardEvent) => {
  const target = event.target
  const isTyping = target instanceof HTMLInputElement

  if (event.key === 'Escape') {
    event.preventDefault()
    if (editingTags.value) {
      stopEditingTags()
    } else {
      emit('close')
    }
  }

  if (!isTyping && event.key === 'ArrowLeft') {
    event.preventDefault()
    emit('previous')
  }

  if (!isTyping && event.key === 'ArrowRight') {
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
  savingTags.value = true

  try {
    const response = await $fetch<{ tags: ImageTag[] }>(`/api/images/${props.image.id}/tags`, {
      method: 'PUT',
      body: {
        tags: draftTags.value.map((tag) => tag.name),
      },
    })

    emit('tagsUpdated', props.image.id, response.tags)
    draftTags.value = response.tags
    tagError.value = ''
  } catch (error) {
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

watch(() => props.image.id, () => {
  editingTags.value = false
  syncDraftTags()
})

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
          :aria-label="`Filter by ${tag.name}`"
          @click="$emit('filterTag', tag)"
        >
          {{ tag.name }}
        </button>

        <button
          :class="styles.addTagButton"
          type="button"
          aria-label="Add or edit tags"
          @click="startEditingTags"
        >
          {{ image.tags.length === 0 ? '+ Add tag' : '+' }}
        </button>

        <p
          v-if="filterNotice"
          :class="styles.filterNotice"
        >
          {{ filterNotice }}
        </p>
      </div>

      <form
        v-else
        :class="styles.tagEditor"
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
