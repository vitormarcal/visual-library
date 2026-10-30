export type LibraryDestination = {
  screen: 'library' | 'explore' | 'subject' | 'similar' | 'duplicates'
  subjectId: string | null
  referenceId: string | null
  selectionId: string | null
  reviewMode: 'likely' | 'broad'
  searchMode: 'text' | 'content'
  query: string
  tagIds: string[]
  imageId: string | null
  hidden: boolean
  problem: string | null
}

export const libraryDestination = (screen: LibraryDestination['screen'] = 'library'): LibraryDestination => ({
  screen, reviewMode: 'likely', subjectId: null, referenceId: null, selectionId: null, searchMode: 'text', query: '', tagIds: [], imageId: null, hidden: false, problem: null,
})

export const parseLibraryDestination = (url: URL): LibraryDestination => {
  const params = url.searchParams
  // Preserve older Library links that carried criteria without an explicit view.
  const legacyLibrary = ['q', 'tag', 'image'].some((key) => params.has(key))
  const view = params.get('view') ?? (legacyLibrary ? 'library' : 'explore')
  const destination = libraryDestination(view === 'explore' || view === 'subject' || view === 'similar' || view === 'duplicates' ? view : 'library')
  destination.reviewMode = params.get('review') === 'broad' ? 'broad' : 'likely'
  destination.subjectId = params.get('subject')
  destination.referenceId = params.get('reference')
  destination.selectionId = params.get('selection')
  destination.query = params.get('q') ?? ''
  destination.searchMode = params.get('mode') === 'content' ? 'content' : 'text'
  destination.tagIds = [...new Set(params.getAll('tag'))].filter((id) => id !== destination.subjectId)
  destination.imageId = params.get('image')
  destination.hidden = params.get('visibility') === 'hidden'
  if ((params.has('visibility') && (params.get('visibility') !== 'hidden' || destination.screen !== 'library'))
    || (params.has('mode') && (params.get('mode') !== 'content' || destination.screen !== 'library' || destination.hidden))
    || (destination.searchMode === 'content' && destination.query.length > 500)
    || !['library', 'explore', 'subject', 'similar', 'duplicates'].includes(view)
    || ['view', 'subject', 'reference', 'selection', 'mode', 'q', 'image', 'visibility', 'review'].some((key) => params.getAll(key).length > 1)
    || (destination.screen === 'subject' ? !destination.subjectId : destination.subjectId !== null)
    || (destination.screen === 'similar' ? !destination.referenceId || Boolean(destination.query || destination.tagIds.length) : destination.screen === 'duplicates' ? Boolean(params.has('reference') && (!destination.referenceId || !/^[a-f0-9]{64}$/.test(destination.referenceId))) || Boolean(destination.query || destination.tagIds.length || destination.imageId) : destination.referenceId !== null)
    || (params.has('review') && (destination.screen !== 'duplicates' || !['likely','broad'].includes(params.get('review')!)))
    || destination.tagIds.some((id) => !id)
    || (params.has('image') && !destination.imageId)
    || (destination.selectionId !== null && (destination.screen !== 'explore' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(destination.selectionId)))
    || (destination.screen === 'explore' && ((destination.imageId && !destination.selectionId) || destination.tagIds.length))) {
    destination.problem = 'This address does not identify a valid library destination.'
  } else if (destination.tagIds.length + (destination.screen === 'subject' ? 1 : 0) > 3) {
    destination.problem = 'This address has too many tag filters. Choose up to three.'
  }
  return destination
}

export const libraryDestinationUrl = (destination: LibraryDestination, source = '/'): string => {
  const url = new URL(source, 'http://library.local')
  for (const key of ['view', 'subject', 'reference', 'selection', 'mode', 'q', 'tag', 'image', 'visibility', 'review']) url.searchParams.delete(key)
  // Explore searches need an explicit view to distinguish older Library links.
  if (destination.screen !== 'explore' || destination.query || destination.selectionId) url.searchParams.set('view', destination.screen)
  if (destination.screen === 'subject' && destination.subjectId) url.searchParams.set('subject', destination.subjectId)
  if ((destination.screen === 'similar' || destination.screen === 'duplicates') && destination.referenceId) url.searchParams.set('reference', destination.referenceId)
  if (destination.screen === 'duplicates' && destination.reviewMode === 'broad') url.searchParams.set('review', 'broad')
  if (destination.selectionId) url.searchParams.set('selection', destination.selectionId)
  if (destination.searchMode === 'content') url.searchParams.set('mode', 'content')
  if (destination.query) url.searchParams.set('q', destination.query)
  for (const id of [...new Set(destination.tagIds)].filter((id) => id !== destination.subjectId)) url.searchParams.append('tag', id)
  if (destination.hidden) url.searchParams.set('visibility', 'hidden')
  if (destination.imageId) url.searchParams.set('image', destination.imageId)
  return `${url.pathname}${url.search}${url.hash}`
}

export const interceptLibraryLink = (event: MouseEvent): boolean => {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false
  event.preventDefault()
  return true
}
