export type LibraryDestination = {
  screen: 'library' | 'explore' | 'subject' | 'similar'
  subjectId: string | null
  referenceId: string | null
  query: string
  tagIds: string[]
  imageId: string | null
  hidden: boolean
  problem: string | null
}

export const libraryDestination = (screen: LibraryDestination['screen'] = 'library'): LibraryDestination => ({
  screen, subjectId: null, referenceId: null, query: '', tagIds: [], imageId: null, hidden: false, problem: null,
})

export const parseLibraryDestination = (url: URL): LibraryDestination => {
  const params = url.searchParams
  // Preserve older Library links that carried criteria without an explicit view.
  const legacyLibrary = ['q', 'tag', 'image'].some((key) => params.has(key))
  const view = params.get('view') ?? (legacyLibrary ? 'library' : 'explore')
  const destination = libraryDestination(view === 'explore' || view === 'subject' || view === 'similar' ? view : 'library')
  destination.subjectId = params.get('subject')
  destination.referenceId = params.get('reference')
  destination.query = params.get('q') ?? ''
  destination.tagIds = [...new Set(params.getAll('tag'))].filter((id) => id !== destination.subjectId)
  destination.imageId = params.get('image')
  destination.hidden = params.get('visibility') === 'hidden'
  if ((params.has('visibility') && (params.get('visibility') !== 'hidden' || destination.screen !== 'library'))
    || !['library', 'explore', 'subject', 'similar'].includes(view)
    || ['view', 'subject', 'reference', 'q', 'image', 'visibility'].some((key) => params.getAll(key).length > 1)
    || (destination.screen === 'subject' ? !destination.subjectId : destination.subjectId !== null)
    || (destination.screen === 'similar' ? !destination.referenceId || Boolean(destination.query || destination.tagIds.length) : destination.referenceId !== null)
    || destination.tagIds.some((id) => !id)
    || (params.has('image') && !destination.imageId)
    || (destination.screen === 'explore' && (destination.imageId || destination.tagIds.length))) {
    destination.problem = 'This address does not identify a valid library destination.'
  } else if (destination.tagIds.length + (destination.screen === 'subject' ? 1 : 0) > 3) {
    destination.problem = 'This address has too many tag filters. Choose up to three.'
  }
  return destination
}

export const libraryDestinationUrl = (destination: LibraryDestination, source = '/'): string => {
  const url = new URL(source, 'http://library.local')
  for (const key of ['view', 'subject', 'reference', 'q', 'tag', 'image', 'visibility']) url.searchParams.delete(key)
  // Explore searches need an explicit view to distinguish older Library links.
  if (destination.screen !== 'explore' || destination.query) url.searchParams.set('view', destination.screen)
  if (destination.screen === 'subject' && destination.subjectId) url.searchParams.set('subject', destination.subjectId)
  if (destination.screen === 'similar' && destination.referenceId) url.searchParams.set('reference', destination.referenceId)
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
