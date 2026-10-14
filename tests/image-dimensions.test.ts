import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { readImageDimensions } from '../server/image-dimensions.ts'

test('reads dimensions from supported real images and animated GIF/WebP', () => {
  for (const name of ['tiny.png', 'tiny.jpg', 'tiny.gif', 'tiny.webp', 'tiny.avif', 'animated.gif', 'animated.webp']) {
    assert.deepEqual(readImageDimensions(readFileSync(new URL(`./fixtures/images/${name}`, import.meta.url))), { width: 2, height: 2 }, name)
  }
  const portrait = Buffer.from(readFileSync(new URL('./fixtures/images/tiny.png', import.meta.url)))
  portrait.writeUInt32BE(200, 16); portrait.writeUInt32BE(400, 20)
  assert.deepEqual(readImageDimensions(portrait), { width: 200, height: 400 })
})

test('unavailable or unsupported dimension metadata keeps images usable', () => {
  for (const bytes of [Buffer.alloc(0), Buffer.from('invalid'), readFileSync(new URL('./fixtures/images/animated.avif', import.meta.url))]) {
    assert.deepEqual(readImageDimensions(bytes), { width: null, height: null })
  }
})

test('reserves the displayed ratio for EXIF-rotated JPEGs', () => {
  const jpeg = Buffer.from(readFileSync(new URL('./fixtures/images/tiny.jpg', import.meta.url)))
  const frame = jpeg.indexOf(Buffer.from([255, 192]))
  jpeg.writeUInt16BE(400, frame + 5); jpeg.writeUInt16BE(200, frame + 7)
  const exif = Buffer.from('45786966000049492a0008000000010012010300010000000600000000000000', 'hex')
  const size = Buffer.alloc(2); size.writeUInt16BE(exif.length + 2)
  const rotated = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([255, 225]), size, exif, jpeg.subarray(2)])
  assert.deepEqual(readImageDimensions(rotated), { width: 400, height: 200 })
})
