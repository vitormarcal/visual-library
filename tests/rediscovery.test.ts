import assert from 'node:assert/strict'
import test from 'node:test'
import { selectRediscovery, createRediscoveryBatches } from '../app/utils/rediscovery.ts'
const now = Date.parse('2026-10-24T12:00:00Z')
const old = (id: string) => ({ id, createdAt: '2025-01-01T00:00:00Z', hiddenFromGallery: false })
const recent = (id: string) => ({ ...old(id), createdAt: '2026-10-24T00:00:00Z' })
const rng = (seed = 42) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)

test('rediscovery prioritizes old visible saves, deduplicates IDs and reproduces a selection with fixed clock/randomness', () => {
  const images = [...Array.from({ length: 30 }, (_, i) => old(`old-${i}`)), ...Array.from({ length: 10 }, (_, i) => recent(`new-${i}`))]
  const input = [...images, images[0]!, { ...old('hidden'), hiddenFromGallery: true }]
  const snapshot = JSON.stringify(input)
  const selection = selectRediscovery(input, [], now, rng())
  assert.equal(selection.ids.length, 8)
  assert.equal(new Set(selection.ids).size, 8)
  assert.ok(selection.ids.every(id => id.startsWith('old-')))
  assert.equal(selection.includesRecent, false)
  assert.deepEqual(selectRediscovery(input, [], now, rng()), selection)
  assert.equal(JSON.stringify(input), snapshot)
  const next = selectRediscovery(input, selection.ids, now, rng(81))
  assert.ok(next.ids.every(id => !selection.ids.includes(id)))
  assert.notDeepEqual(next.ids, selection.ids)
})

test('recent saves fill the selection before repeating the previous lot; small and empty libraries remain finite', () => {
  const previous = Array.from({ length: 8 }, (_, i) => old(`old-${i}`))
  const images = [...previous, ...Array.from({ length: 8 }, (_, i) => recent(`new-${i}`))]
  const selection = selectRediscovery(images, previous.map(image => image.id), now, rng())
  assert.ok(selection.ids.every(id => id.startsWith('new-')))
  assert.equal(selection.includesRecent, true)
  assert.deepEqual(selectRediscovery([], [], now, rng()), { ids: [], includesRecent: false })
  const small = selectRediscovery([old('a'), recent('b'), { ...old('invalid'), createdAt: '?' }], ['a', 'b'], now, rng())
  assert.deepEqual(new Set(small.ids), new Set(['a', 'b', 'invalid']))
  assert.equal(small.includesRecent, true)
  assert.deepEqual(selectRediscovery([old('a')], ['a'], now, rng()), { ids: ['a'], includesRecent: false })
  const boundary = { ...old('boundary'), createdAt: new Date(now - 30 * 86400000).toISOString() }
  assert.equal(selectRediscovery([boundary], [], now, rng()).includesRecent, false)
})

test('known batches retain only their original IDs across new lots and are bounded to this page session', () => {
  const batches = createRediscoveryBatches()
  const first = batches.create('first', Array.from({ length: 20 }, (_, i) => old(String(i))), [], now, rng())
  const saved = [...first.ids]
  batches.create('second', [old('new')], first.ids, now, rng())
  assert.deepEqual(batches.get('first')?.ids, saved)
  assert.equal(batches.get('missing'), undefined)
  assert.equal(batches.get(null), undefined)
  assert.equal(createRediscoveryBatches().get('first'), undefined)
  for (let i = 0; i < 20; i++) batches.create(`more-${i}`, [], [], now, rng())
  assert.equal(batches.get('first'), undefined)
  assert.ok(batches.get('more-19'))
})
