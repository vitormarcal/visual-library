<script setup lang="ts">
import styles from './GalleryBulkTags.module.css'
const props = defineProps<{
  selecting: boolean
  count: number
  busy: boolean
  notice: string
  tags: { name: string; normalizedName: string }[]
}>()
const emit = defineEmits<{
  enter: []; exit: []; selectAll: []; apply: [tags: string[]]
}>()
const editing = ref(false)
const draft = ref<string[]>([])
const input = ref('')
const error = ref('')
const inputElement = ref<HTMLInputElement | null>(null)
const addButton = ref<HTMLButtonElement | null>(null)
const selectAllButton = ref<HTMLButtonElement | null>(null)
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ')
const suggestions = computed(() => props.tags.filter((tag) =>
  tag.normalizedName.includes(normalize(input.value).toLowerCase())
  && !draft.value.some((name) => name.toLowerCase() === tag.normalizedName)).slice(0, 5))
const add = (value = input.value) => {
  const name = normalize(value)
  if (!name) return true
  if (name.length > 48) { error.value = 'Tag is too long'; return false }
  if (!draft.value.some((tag) => tag.toLowerCase() === name.toLowerCase())) {
    if (draft.value.length >= 8) { error.value = 'Too many tags'; return false }
    draft.value.push(props.tags.find((tag) => tag.normalizedName === name.toLowerCase())?.name ?? name)
  }
  input.value = ''; error.value = ''
  return true
}
const reset = () => { editing.value = false; draft.value = []; input.value = ''; error.value = '' }
const cancel = async () => { reset(); await nextTick(); (props.count ? addButton.value : selectAllButton.value)?.focus() }
const start = async () => { editing.value = true; await nextTick(); inputElement.value?.focus() }
const apply = () => { if (add() && draft.value.length) emit('apply', [...draft.value]) }
const escape = () => { if (props.busy) return; if (editing.value) cancel(); else emit('exit') }
watch(() => props.selecting, reset)
watch(() => props.count, (count) => { if (!count && !props.busy) cancel() })
watch(() => props.busy, (busy, previous) => {
  if (previous && !busy && !props.count) cancel()
})
</script>

<template>
  <section :class="styles.wrap" aria-label="Tag selected images" @keydown.esc.prevent.stop="escape">
    <button v-if="!selecting" type="button" :class="styles.button" @click="emit('enter')">Select</button>
    <template v-else>
      <div :class="styles.row">
        <span role="status">{{ count }} selected</span>
        <button ref="selectAllButton" type="button" :class="styles.button" :disabled="busy" @click="emit('selectAll')">Select all</button>
        <button v-if="!editing" ref="addButton" type="button" :class="styles.button" :disabled="busy || !count" @click="start">Add tags</button>
        <button type="button" :class="[styles.button, styles.secondary]" :disabled="busy" @click="emit('exit')">Done</button>
      </div>
      <form v-if="editing" :class="styles.editor" @submit.prevent="apply">
        <div :class="styles.row">
          <button v-for="tag in draft" :key="tag" type="button" :class="styles.chip" :disabled="busy" :aria-label="`Remove pending tag ${tag}`" @click="draft = draft.filter((name) => name !== tag)">{{ tag }} ×</button>
        </div>
        <div :class="styles.row">
          <input ref="inputElement" v-model="input" :class="styles.input" aria-label="Tag to add to selected images" placeholder="Add tag" :disabled="busy" @keydown.enter.prevent="add()">
          <button type="button" :class="[styles.button, styles.secondary]" :disabled="busy || !input.trim()" @click="add()">Add</button>
          <button type="submit" :class="[styles.button, styles.primary]" :disabled="busy || !count || (!draft.length && !input.trim())">{{ busy ? 'Applying…' : 'Apply' }}</button>
          <button type="button" :class="[styles.button, styles.secondary]" :disabled="busy" @click="cancel">Cancel</button>
        </div>
        <div v-if="input.trim()" :class="styles.row">
          <button v-for="tag in suggestions" :key="tag.normalizedName" type="button" :class="styles.chip" :disabled="busy" @click="add(tag.name)">{{ tag.name }}</button>
        </div>
        <p v-if="error" :class="styles.error" role="status">{{ error }}</p>
      </form>
    </template>
    <p v-if="notice" :class="styles.notice" role="status">{{ notice }}</p>
  </section>
</template>
