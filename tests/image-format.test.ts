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
