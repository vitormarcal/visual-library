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
  for (const tail of [Buffer.from('<script>invalid</script>'), Buffer.alloc(64 * 1024 + 1), Buffer.from('SEFHSEFT')]) {
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


test('accepts complete JPEGs with bounded AFCP metadata in either byte order without changing bytes', async () => {
  const { withAfcpMetadata } = await import('./helpers/afcp-jpeg.ts')
  const jpeg = readFileSync(new URL('./fixtures/images/tiny.jpg', import.meta.url))
  for (const little of [false, true]) {
    const data = withAfcpMetadata(jpeg, little), original = Buffer.from(data)
    assert.ok(data.lastIndexOf(Buffer.from([255, 217])) > jpeg.length, 'metadata contains embedded JPEG previews')
    assert.equal(validateImageFormat(data).mimeType, 'image/jpeg')
    assert.deepEqual(data, original)
    for (const amount of [1, 4, 8, 12, 24]) assert.throws(() => validateImageFormat(data.subarray(0, -amount)))
  }
})

test('rejects AFCP headers with broken versions counts offsets bounds coverage or signatures', async () => {
  const { withAfcpMetadata } = await import('./helpers/afcp-jpeg.ts')
  const jpeg = readFileSync(new URL('./fixtures/images/tiny.jpg', import.meta.url)), start = jpeg.length
  for (const little of [false, true]) {
    const source = withAfcpMetadata(jpeg, little), footer = source.length - 12
    const u16 = (b: Buffer, value: number, offset: number) => little ? b.writeUInt16LE(value, offset) : b.writeUInt16BE(value, offset)
    const u32 = (b: Buffer, value: number, offset: number) => little ? b.writeUInt32LE(value, offset) : b.writeUInt32BE(value, offset)
    const mutations = [
      (b: Buffer) => { b[start] = b[start]! | 128 },
      (b: Buffer) => { b[footer] = b[footer]! | 128 },
      (b: Buffer) => u16(b, 2, start + 4),
      (b: Buffer) => u16(b, 0, start + 6),
      (b: Buffer) => u16(b, 65535, start + 6),
      (b: Buffer) => u32(b, 1, start + 8),
      (b: Buffer) => u32(b, 1, footer + 8),
      (b: Buffer) => u32(b, 0xffffffff, footer + 4),
      (b: Buffer) => u32(b, start - 1, footer + 4),
      (b: Buffer) => { b[start + 12] = 0 },
      (b: Buffer) => u32(b, 0, start + 16),
      (b: Buffer) => u32(b, 0xffffffff, start + 16),
      (b: Buffer) => u32(b, start - 1, start + 20),
      (b: Buffer) => u32(b, start + 12, start + 20),
      (b: Buffer) => u32(b, start + 49, start + 20), // Gap before first value.
      (b: Buffer) => u32(b, start + 48, start + 32), // Overlapping values.
      (b: Buffer) => u32(b, footer, start + 44),
    ]
    for (const mutate of mutations) {
      const data = Buffer.from(source); mutate(data)
      assert.throws(() => validateImageFormat(data))
    }
  }
  assert.throws(() => validateImageFormat(withAfcpMetadata(jpeg.subarray(0, -2))))
  assert.throws(() => validateImageFormat(withAfcpMetadata(Buffer.from([255, 216, 255, 217]))))
  assert.throws(() => validateImageFormat(withAfcpMetadata(Buffer.concat([jpeg, Buffer.from('gap')]))))
})

test('accepts only bounded NUL padding after a complete JPEG', () => {
  const jpeg = readFileSync(new URL('./fixtures/images/tiny.jpg', import.meta.url))
  for (const length of [1, 140, 6619, 64 * 1024]) {
    const data = Buffer.concat([jpeg, Buffer.alloc(length)]), original = Buffer.from(data)
    assert.equal(validateImageFormat(data).mimeType, 'image/jpeg')
    assert.deepEqual(data, original)
  }
  assert.throws(() => validateImageFormat(Buffer.concat([jpeg, Buffer.alloc(64 * 1024 + 1)])))
  for (const byte of [1, 32, 255]) {
    const data = Buffer.concat([jpeg, Buffer.alloc(6619)])
    data[data.length - 1] = byte
    assert.throws(() => validateImageFormat(data))
  }
  assert.throws(() => validateImageFormat(Buffer.concat([jpeg.subarray(0, -2), Buffer.alloc(6619)])))
})
