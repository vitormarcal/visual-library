import assert from 'node:assert/strict'
import test from 'node:test'
import { automaticTagFolders, sharedSingleImageFolderCards } from '../app/utils/tag-exploration.ts'

test('shared single-image cards preserve every folder and alphabetical order without changing inputs', () => {
  const groups = [
    { id: 'z', name: 'Zulu', imageCount: 1, previews: [{ id: 'x', src: '/same' }] },
    { id: 'a', name: 'Alpha', imageCount: 1, previews: [{ id: 'x', src: '/same' }] },
    { id: 'b', name: 'Beta', imageCount: 2, previews: [{ id: 'x', src: '/same' }, { id: 'y', src: '/other' }] },
    { id: 'c', name: 'Charlie', imageCount: 1, previews: [{ id: 'different-id', src: '/same' }] },
    { id: 'd', name: 'Delta', imageCount: 1, previews: [] },
  ]
  const before = structuredClone(groups)
  const result = sharedSingleImageFolderCards(groups)
  assert.deepEqual(result.map(card => card.key), ['image:x', 'folder:b', 'image:different-id', 'folder:d'])
  assert.deepEqual(result[0]?.folders.map(folder => folder.id), ['a', 'z'])
  assert.equal(result[0]?.previews.length, 1)
  assert.equal(result[1]?.folders.length, 1, 'same main cover must not group different contents')
  assert.equal(result.flatMap(card => card.folders).length, groups.length)
  assert.deepEqual(groups, before)
  assert.deepEqual(sharedSingleImageFolderCards([...groups].reverse()), result)
})

test('membership changes split shared covers and filtered search keeps only matching folder identities', () => {
  const a = { id: 'a', name: 'Alpha', normalizedName: 'alpha' }
  const b = { id: 'b', name: 'Beta', normalizedName: 'beta' }
  const c = { id: 'c', name: 'Charlie', normalizedName: 'charlie' }
  const image = { id: 'x', src: '/x', tags: [a, b, c] }
  const extra = { id: 'y', src: '/y', tags: [b], hiddenFromGallery: false }
  const initial = sharedSingleImageFolderCards(automaticTagFolders([image], []))
  assert.equal(initial.length, 1)
  assert.deepEqual(initial[0]?.folders.map(folder => folder.id), ['a', 'b', 'c'])
  const split = sharedSingleImageFolderCards(automaticTagFolders([image, extra], []))
  assert.equal(split.length, 2)
  assert.deepEqual(split[0]?.folders.map(folder => folder.id), ['a', 'c'])
  assert.equal(split[1]?.folders[0]?.id, 'b')
  assert.equal(split[1]?.folders[0]?.imageCount, 2)
  assert.equal(sharedSingleImageFolderCards(automaticTagFolders([image, { ...extra, hiddenFromGallery: true }], [])).length, 1)
  const search = sharedSingleImageFolderCards(automaticTagFolders([image], [], ' BETA '))
  assert.equal(search.length, 1)
  assert.deepEqual(search[0]?.folders.map(folder => folder.id), ['b'])
  assert.equal(image.tags.length, 3)
})

test('shared cards span alphabetical positions before pagination and distinguish unavailable previews', () => {
  const folders = Array.from({ length: 50 }, (_, i) => ({
    id: `tag-${i}`, name: `Folder ${String(i).padStart(2, '0')}`, imageCount: 1,
    previews: [{ id: i % 2 ? 'shared' : `image-${i}` }],
  }))
  const cards = sharedSingleImageFolderCards(folders)
  assert.equal(cards.length, 26)
  assert.equal(cards.find(card => card.key === 'image:shared')?.folders.length, 25)
  assert.equal(cards.flatMap(card => card.folders).length, 50)
  assert.equal(cards.findIndex(card => card.folders.some(folder => folder.id === 'tag-49')), 1)
  const unavailable = sharedSingleImageFolderCards([
    { id: 'a', name: 'A', imageCount: 1, previews: [] },
    { id: 'b', name: 'B', imageCount: 1, previews: [] },
  ])
  assert.equal(unavailable.length, 2)
})
