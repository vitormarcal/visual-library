<script setup lang="ts">
import styles from './FolderGrid.module.css'
import { sharedSingleImageFolderCards } from '../utils/tag-exploration'
import { interceptLibraryLink, libraryDestination, libraryDestinationUrl } from '../utils/library-navigation'
type Preview = { id: string; thumbnailSrc?: string | null; src: string; width?: number | null; height?: number | null }
type Group = { previews: Preview[]; id: string; name: string; normalizedName: string; imageCount: number }
const props = defineProps<{
  groups: Group[]
  loading: boolean
  error: boolean
  hasTags: boolean
  restoreFocusId?: string | null
  dimensions: Record<string, { width: number; height: number }>
  libraryHref: string
}>()
const query = defineModel<string>('query', { default: '' })
const emit = defineEmits<{
  open: [group: Group]
  library: []
  retry: []
  dimension: [id: string, width: number, height: number]
}>()
const directory = ref<HTMLElement | null>(null)
const listId = useId()
const expandedCards = useState<string[]>('expanded-shared-folder-cards', () => [])
const cards = computed(() => sharedSingleImageFolderCards(props.groups))
const visibleCount = useState('folders-visible-count', () => 30)
const visibleCards = computed(() => cards.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < cards.value.length)
const showMore = () => { visibleCount.value += 30 }
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
watch(query, () => { visibleCount.value = 30 })
// A restored directory can point beyond the first batch, including after reload.
watch([() => props.restoreFocusId, cards], () => {
  const index = cards.value.findIndex(card => card.folders.some(folder => folder.id === props.restoreFocusId))
  if (index < 0) return
  visibleCount.value = Math.max(visibleCount.value, index + 1)
  const card = cards.value[index]!
  if (card.folders.findIndex(folder => folder.id === props.restoreFocusId) >= 3 && !expandedCards.value.includes(card.key)) expandedCards.value = [...expandedCards.value, card.key]
}, { immediate: true })
// Regrouping must not lose a focused folder link if its card changes shape.
watch(cards, async () => {
  if (!import.meta.client) return
  const active = document.activeElement as HTMLElement | null
  const id = directory.value?.contains(active) ? active?.dataset.folderTagId : null
  if (!id) return
  await nextTick()
  if (active?.isConnected) return
  const target = directory.value?.querySelector<HTMLElement>(`[data-folder-tag-id="${CSS.escape(id)}"]`) ?? document.querySelector<HTMLElement>('[data-folder-search]')
  target?.focus({ preventScroll: true })
})
const toggleNames = (key: string) => {
  expandedCards.value = expandedCards.value.includes(key) ? expandedCards.value.filter(value => value !== key) : [...expandedCards.value, key]
}
const chooseFolder = async (card: typeof cards.value[number]) => {
  if (card.folders.length > 3 && !expandedCards.value.includes(card.key)) toggleNames(card.key)
  await nextTick()
  const id = card.folders[0]?.id
  const target = id ? directory.value?.querySelector<HTMLElement>(`[data-folder-tag-id="${CSS.escape(id)}"]`) : null
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
}
onMounted(() => {
  if (!('IntersectionObserver' in window)) return
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && hasMore.value) showMore()
  }, { rootMargin: '400px' })
  if (sentinel.value) observer.observe(sentinel.value)
})
watch(sentinel, (element) => {
  observer?.disconnect()
  if (element) observer?.observe(element)
})
onBeforeUnmount(() => observer?.disconnect())
const open = (event: MouseEvent, group: Group) => { if (interceptLibraryLink(event)) emit('open', group) }
const backToLibrary = (event: MouseEvent) => { if (interceptLibraryLink(event)) emit('library') }
const subjectHref = (id: string) => libraryDestinationUrl({ ...libraryDestination('subject'), subjectId: id })
const resetQuery = async () => {
  query.value = ''
  await nextTick()
  document.querySelector<HTMLInputElement>('[data-folder-search]')?.focus({ preventScroll: true })
}
</script>

<template>
  <section ref="directory" aria-label="Folders">
    <div v-if="loading" :class="styles.grid" role="status" aria-label="Loading folders">
      <span v-for="n in 8" :key="n" :class="styles.skeleton" aria-hidden="true" />
    </div>
    <div v-else-if="error" :class="styles.empty" role="status">
      <p>Could not load folders.</p>
      <button type="button" :class="styles.action" @click="$emit('retry')">Try again</button>
    </div>
    <div v-else-if="!hasTags" :class="styles.empty">
      <p>Folders appear automatically when you add tags to saved images.</p>
      <a :href="libraryHref" :class="styles.action" @click="backToLibrary">View images</a>
    </div>
    <div v-else-if="!groups.length" :class="styles.empty" role="status">
      <p>No folders match your search.</p><button type="button" :class="styles.action" @click="resetQuery">Clear search</button>
    </div>
    <div v-else>
      <div :class="styles.grid">
        <article v-for="card in visibleCards" :key="card.key" :class="styles.card" :data-folder-card="card.key">
          <a v-if="card.folders.length === 1" :href="subjectHref(card.folders[0]!.id)" :class="styles.folderLink" :data-folder-tag-id="card.folders[0]!.id"
            :aria-label="`Open folder ${card.folders[0]!.name}, ${card.folders[0]!.imageCount} ${card.folders[0]!.imageCount === 1 ? 'image' : 'images'}`"
            @click="open($event, card.folders[0]!)">
            <FolderCover :previews="card.previews" :dimensions="dimensions" @dimension="(id, width, height) => emit('dimension', id, width, height)" />
            <span :class="styles.label">
              <span :class="styles.name">{{ card.folders[0]!.name }}</span>
              <span :class="styles.count">{{ card.folders[0]!.imageCount }} {{ card.folders[0]!.imageCount === 1 ? 'image' : 'images' }}</span>
            </span>
          </a>
          <template v-else>
            <button type="button" :class="styles.coverButton" :aria-label="`Choose a folder (${card.folders.length} folders)`"
              :aria-expanded="card.folders.length > 3 ? expandedCards.includes(card.key) : undefined" :aria-controls="`${listId}-${card.key}`" @click="chooseFolder(card)">
              <FolderCover :previews="card.previews" :dimensions="dimensions" @dimension="(id, width, height) => emit('dimension', id, width, height)" />
            </button>
            <p :class="styles.sharedCount">1 image · {{ card.folders.length }} folders</p>
            <div :id="`${listId}-${card.key}`" :class="styles.folderChoices">
              <a v-for="folder in card.folders.slice(0, 3)" :key="folder.id" :href="subjectHref(folder.id)"
                :class="styles.folderChoice" :data-folder-tag-id="folder.id" :aria-label="`Open folder ${folder.name}, 1 image`" @click="open($event, folder)">{{ folder.name }}</a>
            </div>
            <template v-if="card.folders.length > 3">
              <button type="button" :class="styles.expandNames" :aria-expanded="expandedCards.includes(card.key)"
                :aria-controls="`${listId}-${card.key}-more`" @click="toggleNames(card.key)">{{ expandedCards.includes(card.key) ? 'Show fewer folders' : `Show ${card.folders.length - 3} more folders` }}</button>
              <div v-if="expandedCards.includes(card.key)" :id="`${listId}-${card.key}-more`" :class="styles.folderChoices">
                <a v-for="folder in card.folders.slice(3)" :key="folder.id" :href="subjectHref(folder.id)" :class="styles.folderChoice"
                  :data-folder-tag-id="folder.id" :aria-label="`Open folder ${folder.name}, 1 image`" @click="open($event, folder)">{{ folder.name }}</a>
              </div>
            </template>
          </template>
        </article>
      </div>
      <div v-if="hasMore" ref="sentinel" :class="styles.more">
        <button type="button" :class="styles.action" @click="showMore">Load more folders</button>
      </div>
    </div>
  </section>
</template>
