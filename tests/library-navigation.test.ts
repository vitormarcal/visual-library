import assert from 'node:assert/strict'
import test from 'node:test'
import { libraryDestination, libraryDestinationUrl, parseLibraryDestination } from '../app/utils/library-navigation.ts'

test('navigation addresses preserve subject identity, refinements and an image beyond the gallery', () => {
  const requested = {
    ...libraryDestination('subject'), subjectId: 'pessoa & obra/é', query: '  Wallpaper azul  ',
    tagIds: ['outro + assunto'], imageId: 'outside-gallery',
  }
  const address = libraryDestinationUrl(requested, '/?tracking=keep#section')
  assert.deepEqual(parseLibraryDestination(new URL(address, 'http://library.local')), requested)
  assert.ok(address.includes('tracking=keep'))
  assert.ok(address.endsWith('#section'))
  assert.deepEqual(parseLibraryDestination(new URL('http://library.local/')), libraryDestination())
  const directory = { ...libraryDestination('explore'), query: 'manara' }
  assert.deepEqual(parseLibraryDestination(new URL(libraryDestinationUrl(directory), 'http://library.local')), directory)
})

test('malformed destinations and unavailable filter identities are not silently broadened', () => {
  for (const address of [
    '/?view=unknown', '/?view=subject', '/?subject=a', '/?view=explore&image=a',
    '/?view=explore&tag=a', '/?tag=', '/?image=', '/?q=one&q=two',
    '/?view=subject&subject=a&tag=b&tag=c&tag=d', '/?tag=a&tag=b&tag=c&tag=d',
  ]) {
    assert.ok(parseLibraryDestination(new URL(address, 'http://library.local')).problem, address)
  }
  const destination = parseLibraryDestination(new URL('http://library.local/?view=subject&subject=a&tag=a&tag=b&tag=b&tag=missing'))
  assert.equal(destination.problem, null)
  assert.deepEqual(destination.tagIds, ['b', 'missing'])
  assert.equal(destination.subjectId, 'a')
  const reopened = parseLibraryDestination(new URL(libraryDestinationUrl(destination), 'http://library.local'))
  assert.deepEqual(reopened, destination)
})

test('closing the viewer retains gallery criteria and clean card entries remain independent', () => {
  const refined = parseLibraryDestination(new URL('http://library.local/?view=subject&subject=manara&q=alpha&tag=publication&image=c'))
  const closed = { ...refined, imageId: null }
  assert.deepEqual(parseLibraryDestination(new URL(libraryDestinationUrl(closed), 'http://library.local')), closed)
  assert.equal(closed.query, 'alpha')
  assert.deepEqual(closed.tagIds, ['publication'])
  const card = { ...libraryDestination('subject'), subjectId: 'manara' }
  assert.equal(parseLibraryDestination(new URL(libraryDestinationUrl(card), 'http://library.local')).query, '')
  assert.deepEqual(card.tagIds, [])
})
