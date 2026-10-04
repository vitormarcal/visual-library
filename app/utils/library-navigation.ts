export type LibraryDestination = {
  screen: 'library' | 'explore' | 'subject'
  subjectId: string | null
  query: string
  tagIds: string[]
  imageId: string | null
  problem: string | null
}

export const libraryDestination = (screen: LibraryDestination['screen'] = 'library'): LibraryDestination => ({
  screen, subjectId: null, query: '', tagIds: [], imageId: null, problem: null,
})

export const parseLibraryDestination = (url: URL): LibraryDestination => {
  const params = url.searchParams
  const view = params.get('view') ?? 'library'
  const destination = libraryDestination(view === 'explore' || view === 'subject' ? view : 'library')
  destination.subjectId = params.get('subject')
  destination.query = params.get('q') ?? ''
  destination.tagIds = [...new Set(params.getAll('tag'))].filter((id) => id !== destination.subjectId)
  destination.imageId = params.get('image')
  if (!['library', 'explore', 'subject'].includes(view)
    || ['view', 'subject', 'q', 'image'].some((key) => params.getAll(key).length > 1)
    || (destination.screen === 'subject' ? !destination.subjectId : destination.subjectId !== null)
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
  for (const key of ['view', 'subject', 'q', 'tag', 'image']) url.searchParams.delete(key)
  if (destination.screen !== 'library') url.searchParams.set('view', destination.screen)
  if (destination.screen === 'subject' && destination.subjectId) url.searchParams.set('subject', destination.subjectId)
  if (destination.query) url.searchParams.set('q', destination.query)
  for (const id of [...new Set(destination.tagIds)].filter((id) => id !== destination.subjectId)) url.searchParams.append('tag', id)
  if (destination.imageId) url.searchParams.set('image', destination.imageId)
  return `${url.pathname}${url.search}${url.hash}`
}

export const interceptLibraryLink = (event: MouseEvent): boolean => {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false
  event.preventDefault()
  return true
}
