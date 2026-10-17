import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clsEmbedding, comparisonMethods, meanPatchEmbedding, colorFeatures, dot, normalize, rank, sampleEvenly, similarity } from './ranking.mjs'

test('patch averaging excludes CLS and normalizes the mean instead of selecting a token', () => {
  const data = new Float32Array(3 * 384)
  data[0] = 999; data[384 + 1] = 2; data[768 + 2] = 2
  const result = meanPatchEmbedding({ dims: [1, 3, 384], data })
  assert.equal(result[0], 0)
  assert.ok(Math.abs(result[1] - Math.SQRT1_2) < 1e-10)
  assert.equal(result[1], result[2])
  assert.throws(() => meanPatchEmbedding({ dims: [1, 1, 384], data }), /Unexpected/)
  assert.throws(() => meanPatchEmbedding({ dims: [1, 3, 384], data: data.slice(0, 384) }), /Unexpected/)
})

test('variant weights sum to one and color-first ranking can favor palette over global semantics', () => {
  for (const config of Object.values(comparisonMethods)) if (config.weights) assert.ok(Math.abs(config.weights.reduce((a, b) => a + b) - 1) < 1e-10)
  const reference = { id: 'a', embedding: [1, 0], meanEmbedding: [0, 1], fullEmbedding: [0, 1], palette: [1, 0], spatial: [0.5] }
  const subject = { ...reference, id: 'subject', palette: [0, 1] }
  const color = { ...reference, id: 'color', embedding: [0, 1] }
  assert.equal(rank(reference, [subject, color], 'combined')[0].id, 'subject')
  assert.equal(rank(reference, [subject, color], 'colorCls')[0].id, 'color')
  assert.equal(similarity(reference, reference, 'full'), 1)
  assert.equal(similarity(reference, reference, 'mean'), 1)
  assert.throws(() => similarity(reference, color, 'typo'), /Unknown/)
})

test('DINOv2 CLS extraction uses only the first token and checks output shape', () => {
  const data = new Float32Array(768).fill(10)
  data.fill(0, 0, 384); data[0] = 2
  assert.deepEqual(clsEmbedding({ dims: [1, 2, 384], data }), [1, ...new Array(383).fill(0)])
  assert.throws(() => clsEmbedding({ dims: [1, 384], data }), /Unexpected/)
})

test('normalized embeddings rank independently of tags, exclude self and break ties consistently', () => {
  const base = { embedding: normalize([2, 0]), palette: [1, 0], spatial: [0.5, 0.5] }
  const reference = { ...base, id: 'reference' }
  const candidates = [reference, { ...base, id: 'z' }, { ...base, id: 'a' }, { ...base, id: 'other', embedding: [0, 1] }]
  assert.deepEqual(rank(reference, candidates, 'embedding').map(item => item.id), ['a', 'z', 'other'])
  assert.equal(rank(reference, candidates, 'embedding', 1).length, 1)
  assert.equal(dot(normalize([3, 4]), normalize([3, 4])), 1)
  assert.throws(() => normalize([0, 0]), /Invalid/)
  assert.throws(() => normalize([NaN, 1]), /Invalid/)
  assert.throws(() => dot([1], [1, 0]), /Incompatible/)
})

test('same palette with reversed placement has equal palette score but lower combined score', () => {
  const pixels = (reverse = false) => Uint8Array.from(Array.from({ length: 16 }, (_, index) => {
    const red = (index < 8) !== reverse
    return red ? [255, 0, 0] : [0, 0, 255]
  }).flat())
  const a = { embedding: [1], ...colorFeatures(pixels(), 4, 4) }
  const b = { embedding: [1], ...colorFeatures(pixels(true), 4, 4) }
  assert.equal(similarity(a, a, 'palette'), similarity(a, b, 'palette'))
  assert.ok(similarity(a, a) > similarity(a, b))
  const black = colorFeatures(new Uint8Array(48), 4, 4)
  assert.ok(black.palette.every(Number.isFinite))
  assert.ok(black.spatial.every(value => value === 0))
  assert.throws(() => colorFeatures(new Uint8Array(3), 4, 4), /Invalid/)
})

test('sampling covers chronological range with unique entries and bounded size', () => {
  assert.deepEqual(sampleEvenly([0, 1, 2, 3, 4], 3), [0, 2, 4])
  assert.deepEqual(sampleEvenly([0, 1], 10), [0, 1])
  assert.deepEqual(sampleEvenly([], 10), [])
  assert.deepEqual(sampleEvenly([0, 1], 1), [0])
  assert.throws(() => sampleEvenly([0], 0), /Invalid/)
})
