import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { validateImageFormat } from '../server/image-format.ts'
import { parseImageSizeLimit } from '../server/image-upload.ts'

for (const [extension, mime] of [['png', 'image/png'], ['jpg', 'image/jpeg'], ['gif', 'image/gif'], ['webp', 'image/webp'], ['avif', 'image/avif']]) {
  test(`validates real ${extension} bytes and rejects truncation`, () => {
    const data = readFileSync(new URL(`./fixtures/images/tiny.${extension}`, import.meta.url))
    assert.equal(validateImageFormat(data).mimeType, mime)
    for (const end of [1, Math.floor(data.length / 2), data.length - 1]) assert.throws(() => validateImageFormat(data.subarray(0, end)))
  })
}
test('rejects active markup and forged or inconsistent image structures', () => {
  for (const content of ['<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'not a png', '<html>image</html>']) assert.throws(() => validateImageFormat(Buffer.from(content)))
  const png = readFileSync(new URL('./fixtures/images/tiny.png', import.meta.url))
  const forged = Buffer.from(png); forged.writeUInt32BE(0xffffffff, 8)
  assert.throws(() => validateImageFormat(forged))
})
test('size configuration accepts positive safe integers only', () => {
  assert.equal(parseImageSizeLimit('1024'), 1024)
  for (const input of [0, -1, NaN, Infinity, 'no', '1.5', null, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parseImageSizeLimit(input))
})

for (const extension of ['gif', 'webp', 'avif']) {
  test(`accepts animated ${extension} structure`, () => {
    const bytes = readFileSync(new URL(`./fixtures/images/animated.${extension}`, import.meta.url))
    if (extension === 'webp') assert.ok(bytes.includes(Buffer.from('ANMF')), 'fixture must contain animated frames')
    if (extension === 'avif') assert.ok(bytes.includes(Buffer.from('avis')), 'fixture must contain an image sequence')
    assert.equal(validateImageFormat(bytes).mimeType, `image/${extension}`)
    assert.throws(() => validateImageFormat(bytes.subarray(0, bytes.length - 1)))
  })
}

test('accepts complete JPEGs with bounded SEF metadata without changing original bytes', async () => {
  const { withSefMetadata } = await import('./helpers/sef-jpeg.ts')
  const jpeg = readFileSync(new URL('./fixtures/images/tiny.jpg', import.meta.url))
  for (const sizes of [[38, 58], [38, 137]]) {
    const data = withSefMetadata(jpeg, sizes), original = Buffer.from(data)
    assert.equal(data.length - jpeg.length, sizes[1] === 58 ? 140 : 219)
    assert.equal(validateImageFormat(data).mimeType, 'image/jpeg')
    assert.deepEqual(data, original)
    for (const length of [1, 4, 8, 20]) assert.throws(() => validateImageFormat(data.subarray(0, -length)))
  }
})

test('rejects arbitrary JPEG trailers and forged SEF directories or incomplete JPEGs', async () => {
  const { withSefMetadata } = await import('./helpers/sef-jpeg.ts')
  const jpeg = readFileSync(new URL('./fixtures/images/tiny.jpg', import.meta.url))
  for (const tail of [Buffer.from('<script>invalid</script>'), Buffer.alloc(140), Buffer.from('SEFHSEFT')]) {
    assert.throws(() => validateImageFormat(Buffer.concat([jpeg, tail])))
  }
  assert.throws(() => validateImageFormat(withSefMetadata(jpeg.subarray(0, -2))))
  assert.throws(() => validateImageFormat(withSefMetadata(Buffer.from([255, 216, 255, 217]))))
  assert.throws(() => validateImageFormat(withSefMetadata(Buffer.concat([jpeg, Buffer.from('gap')]))))
  const source = withSefMetadata(jpeg), directory = jpeg.length + 96
  const mutations = [
    (b: Buffer) => { b[directory] = b[directory]! | 128 }, // Magic must match exact bytes.
    (b: Buffer) => { b[b.length - 4] = b[b.length - 4]! | 128 },
    (b: Buffer) => b.writeUInt32LE(0xffffffff, b.length - 8), // Directory outside file.
    (b: Buffer) => b.writeUInt32LE(0, directory + 8), // Missing entries.
    (b: Buffer) => b.writeUInt32LE(0xffffffff, directory + 8), // Inconsistent count.
    (b: Buffer) => b.writeUInt32LE(97, directory + 16), // Record starts inside JPEG.
    (b: Buffer) => b.writeUInt32LE(0, directory + 16), // Record extends into directory.
    (b: Buffer) => b.writeUInt32LE(0xffffffff, directory + 20), // Oversized record.
    (b: Buffer) => b.writeUInt32LE(0xffffffff, jpeg.length + 4), // Oversized name.
    (b: Buffer) => b.writeUInt16LE(1, directory + 14), // Record type mismatch.
    (b: Buffer) => b.writeUInt32LE(96, directory + 28), // Overlapping records.
  ]
  for (const mutate of mutations) {
    const data = Buffer.from(source); mutate(data)
    assert.throws(() => validateImageFormat(data))
  }
})
