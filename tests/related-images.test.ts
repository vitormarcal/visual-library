import assert from 'node:assert/strict'
import test from 'node:test'
import { findRelatedImages } from '../app/utils/related-images.ts'

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

test('related images respect supplied visible results, exact tag identity, and six-item limit', () => {
  const candidates = Array.from({ length: 8 }, (_, i) => image(String(i), ['playboy']))
  assert.deepEqual(findRelatedImages(current, candidates).map(({ id }) => id), ['0', '1', '2', '3', '4', '5'])
  assert.deepEqual(findRelatedImages(current, candidates.slice(6)).map(({ id }) => id), ['6', '7'])
  assert.deepEqual(findRelatedImages(image('accent', ['ilustração']), [image('plain', ['ilustracao'])]), [])
})

test('untagged images and images without matches have no recommendations', () => {
  assert.deepEqual(findRelatedImages(image('empty', []), [current]), [])
  assert.deepEqual(findRelatedImages(current, [current, image('other', []), image('manara', ['manara'])]), [])
})
