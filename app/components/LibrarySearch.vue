<script setup lang="ts">
import { normalizeSearch } from '../utils/image-search'
const props = defineProps<{ scope: string; explore?: boolean; content?: boolean; disabled?: boolean; tags: { id: string; name: string; normalizedName: string }[] }>()
const query = defineModel<string>({ default: '' })
const emit = defineEmits<{ submit: []; select: [tag: { id: string; name: string; normalizedName: string }] }>()
const root = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const showing = ref(false)
const suggestions = computed(() => props.content ? [] : props.tags.filter(tag => normalizeSearch(query.value).split(' ').filter(Boolean).every(term => normalizeSearch(tag.name).includes(term))).slice(0, 6))
const closeOutside = (event: Event) => { if (!root.value?.contains(event.target as Node)) showing.value = false }
const leave = () => { requestAnimationFrame(() => { if (!root.value?.contains(document.activeElement)) showing.value = false }) }
const choose = (tag: typeof props.tags[number]) => { emit('select', tag); input.value?.focus(); showing.value = false }
onMounted(() => document.addEventListener('pointerdown', closeOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOutside))
</script>
<template>
  <form ref="root" class="librarySearch" role="search" @focusout="leave" @keydown.esc.stop.prevent="showing = false" @submit.prevent="showing = false; emit('submit')">
    <div class="librarySearchField">
      <LibraryIcon name="search" />
      <input ref="input" v-model="query" :data-library-search="!explore ? '' : undefined" :data-explore-search="explore ? '' : undefined" type="search" :aria-label="scope" :placeholder="scope" :disabled="disabled" :maxlength="content ? 500 : undefined" autocomplete="off" @click="showing = true" @input="showing = true" @keydown.down.prevent="showing = true" @keyup.tab="showing = true">
      <button v-if="query" type="button" aria-label="Clear search" :disabled="disabled" @click="query = ''; input?.focus()">×</button>
    </div>
    <button v-if="content" type="submit" class="searchSubmit" :disabled="disabled">Search</button>
    <div v-if="showing && suggestions.length && !disabled" class="librarySuggestions" aria-label="Suggested subjects">
      <p>{{ explore ? 'Explore a subject' : 'Filter by tag' }}</p>
      <button v-for="tag in suggestions" :key="tag.id" type="button" @click="choose(tag)">{{ tag.name }}</button>
    </div>
  </form>
</template>
<style scoped>
.librarySearch { position: relative; display: flex; gap: 8px; flex: 1; min-width: 0; }
.librarySearchField { position: relative; display: flex; align-items: center; flex: 1; min-width: 0; }
.librarySearchField > svg { position: absolute; left: 16px; color: var(--color-mute); pointer-events: none; }
input { width: 100%; min-width: 0; height: 48px; padding: 0 48px; border: 1px solid transparent; border-radius: var(--radius-full); background: var(--color-surface-card); color: var(--color-ink); font-size: 16px; }
input:focus { background: var(--color-canvas); border-color: var(--color-hairline); }
input::-webkit-search-cancel-button { appearance: none; }
.librarySearchField > button { position: absolute; right: 2px; width: 44px; height: 44px; border: 0; border-radius: var(--radius-full); background: transparent; color: var(--color-ink); }
.searchSubmit { min-height: 44px; padding: 8px 14px; border: 0; border-radius: var(--radius-md); background: var(--color-secondary-bg); font-weight: 600; }
.librarySuggestions { position: absolute; top: 56px; left: 0; z-index: 40; width: min(480px, 100%); max-height: min(360px, 60dvh); overflow: auto; padding: 12px; border: 1px solid var(--color-hairline); border-radius: var(--radius-md); background: var(--color-canvas); box-shadow: 0 8px 24px #00000014; }
.librarySuggestions p { margin: 0 8px 8px; font-size: 12px; color: var(--color-mute); }
.librarySuggestions button { display: block; width: 100%; min-height: 44px; padding: 10px; text-align: left; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--color-ink); font-size: 14px; }
.librarySuggestions button:hover { background: var(--color-surface-card); }
</style>
