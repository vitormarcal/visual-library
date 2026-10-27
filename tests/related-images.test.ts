import assert from 'node:assert/strict'
import test from 'node:test'
import { findRelatedImages, sharedTagCaption, viewerDiscoveryImages } from '../app/utils/related-images.ts'

const image = (id: string, names: string[]) => ({ id, tags: names.map((normalizedName) => ({ normalizedName })) })
const current = image('current', ['playboy', 'mel lisboa'])

test('related images prioritize more shared tags and preserve gallery order for ties', () => {
  const candidates = [current, image('one', ['playboy']), image('both', ['mel lisboa', 'playboy']), image('tie', ['mel lisboa']), image('unrelated', ['manara'])]
  assert.deepEqual(findRelatedImages(current, candidates).map(({ id }) => id), ['both', 'one', 'tie'])
  assert.deepEqual(candidates.map(({ id }) => id), ['current', 'one', 'both', 'tie', 'unrelated'])
})

test('related images exclude repeated IDs and count each shared tag once', () => {
  const repeated = image('repeated', ['playboy', 'playboy', 'playboy'])
  assert.deepEqual(findRelatedImages(current, [repeated, image('both', ['playboy', 'mel lisboa']), repeated, current]).map(({ id }) => id), ['both', 'repeated'])
})

test('related images respect supplied candidate scope, exact tag identity, and six-item limit', () => {
  const candidates = Array.from({ length: 8 }, (_, i) => image(String(i), ['playboy']))
  assert.deepEqual(findRelatedImages(current, candidates).map(({ id }) => id), ['0', '1', '2', '3', '4', '5'])
  assert.deepEqual(findRelatedImages(current, candidates.slice(6)).map(({ id }) => id), ['6', '7'])
  assert.deepEqual(findRelatedImages(image('accent', ['ilustração']), [image('plain', ['ilustracao'])]), [])
})

test('untagged images and images without matches have no recommendations', () => {
  assert.deepEqual(findRelatedImages(image('empty', []), [current]), [])
  assert.deepEqual(findRelatedImages(current, [current, image('other', []), image('manara', ['manara'])]), [])
})

test('full-library connections can leave search results and continue through a different tag', () => {
  const a = image('a', ['manara', 'playboy'])
  const b = image('b', ['playboy', 'mel lisboa'])
  const c = image('c', ['mel lisboa'])
  const library = [a, b, c]
  assert.deepEqual(findRelatedImages(a, library.filter((candidate) => candidate.tags.some((tag) => tag.normalizedName === 'manara'))), [])
  assert.deepEqual(findRelatedImages(a, library).map((candidate) => candidate.id), ['b'])
  assert.deepEqual(findRelatedImages(b, library).map((candidate) => candidate.id), ['a', 'c'])
})

test('connection captions use current tag order, exact identity, and distinct shared tags', () => {
  const current = { tags: [
    { name: 'Mel Lisboa', normalizedName: 'mel lisboa' },
    { name: 'Playboy', normalizedName: 'playboy' },
    { name: 'PLAYBOY', normalizedName: 'playboy' },
    { name: 'Ilustração', normalizedName: 'ilustração' },
  ] }
  assert.equal(sharedTagCaption(current, image('both', ['playboy', 'mel lisboa'])), 'Shared tag: Mel Lisboa (+1)')
  assert.equal(sharedTagCaption(current, image('one', ['playboy'])), 'Shared tag: Playboy')
  assert.equal(sharedTagCaption(current, image('unrelated', ['ilustracao'])), '')
})

test('viewer discovery prioritizes tags, then ranked similarity, then paged library fallback', () => {
  const a = image('tag', ['playboy'])
  const b = image('similar', [])
  const c = image('fallback', [])
  const d = image('later', [])
  const library = [current, c, a, d, b]
  assert.deepEqual(viewerDiscoveryImages(current, library, [b, a]).map(image => image.id), ['tag', 'similar'])
  assert.deepEqual(viewerDiscoveryImages(current, library, [b, a], 1).map(image => image.id), ['tag', 'similar', 'fallback'])
  assert.deepEqual(viewerDiscoveryImages(current, library, [b, a], 2).map(image => image.id), ['tag', 'similar', 'fallback', 'later'])
})

test('viewer discovery removes duplicate results, the reference, and stale ineligible records', () => {
  const currentTag = { ...image('tag', ['playboy']), name: 'Current library record' }
  const staleTag = { ...currentTag, name: 'Stale similarity record' }
  const similar = image('similar', [])
  const result = viewerDiscoveryImages(current, [current, currentTag, similar], [current, staleTag, similar, similar, image('hidden-or-deleted', [])], Infinity)
  assert.deepEqual(result.map(image => image.id), ['tag', 'similar'])
  assert.equal(result[0], currentTag)
})

test('viewer discovery can continue through the library when similarity is unavailable', () => {
  const library = Array.from({ length: 50 }, (_, i) => image(String(i), []))
  assert.equal(viewerDiscoveryImages(current, library, [], 24).length, 24)
  assert.equal(viewerDiscoveryImages(current, library, [], 48).length, 48)
  assert.equal(viewerDiscoveryImages(current, library, [], 72).length, 50)
  assert.deepEqual(viewerDiscoveryImages(current, [], [], 24), [])
})
