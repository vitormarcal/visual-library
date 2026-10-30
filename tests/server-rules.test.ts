import assert from 'node:assert/strict'
import test from 'node:test'
import { hashImageBytes, normalizeTagName, normalizeTagValues } from '../server/db.ts'
import { isPublicIpAddress, isPublicRemoteTarget, parseRemoteUrl } from '../server/image-url.ts'

test('normalizes tag whitespace and comparison key', () => {
  assert.deepEqual(normalizeTagName('  Dark      Room  '), {
    name: 'Dark Room',
    normalizedName: 'dark room',
  })
})

test('normalizes tag values by removing empty values and case-insensitive duplicates', () => {
  assert.deepEqual(normalizeTagValues([' cozy ', '', 'COZY', 'warm  lighting']), [
    { name: 'cozy', normalizedName: 'cozy' },
    { name: 'warm lighting', normalizedName: 'warm lighting' },
  ])
})

test('accepts many tags while preserving the name length limit', () => {
  assert.equal(normalizeTagValues(Array.from({ length: 500 }, (_, index) => `tag ${index}`)).length, 500)

  assert.throws(
    () => normalizeTagValues(['x'.repeat(49)]),
    /Tag is too long/,
  )
})

test('hashes exact image bytes deterministically', () => {
  const first = hashImageBytes(Buffer.from('same bytes'))
  const second = hashImageBytes(Buffer.from('same bytes'))
  const different = hashImageBytes(Buffer.from('different bytes'))

  assert.equal(first, second)
  assert.notEqual(first, different)
  assert.equal(
    hashImageBytes(Buffer.from('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
})

test('recognizes public and non-public IP addresses', () => {
  assert.equal(isPublicIpAddress('8.8.8.8'), true)
  assert.equal(isPublicIpAddress('1.1.1.1'), true)
  assert.equal(isPublicIpAddress('10.0.0.1'), false)
  assert.equal(isPublicIpAddress('172.16.0.1'), false)
  assert.equal(isPublicIpAddress('192.168.1.1'), false)
  assert.equal(isPublicIpAddress('127.0.0.1'), false)
  assert.equal(isPublicIpAddress('169.254.1.1'), false)
  assert.equal(isPublicIpAddress('::1'), false)
  for (const ip of ['0:0:0:0:0:0:0:1', '::ffff:127.0.0.1', '::ffff:7f00:1', '100::1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001::1', '3fff::1']) assert.equal(isPublicIpAddress(ip), false, ip)
  assert.equal(isPublicIpAddress('fd00::1'), false)
  assert.equal(isPublicIpAddress('2001:4860:4860::8888'), true)
})

test('recognizes public remote targets after hostname resolution', () => {
  assert.equal(isPublicRemoteTarget('localhost'), false)
  assert.equal(isPublicRemoteTarget('images.localhost'), false)
  assert.equal(isPublicRemoteTarget('127.0.0.1'), false)
  assert.equal(isPublicRemoteTarget('8.8.8.8'), true)
  assert.equal(isPublicRemoteTarget('example.com', [{ address: '10.0.0.1' }]), false)
  assert.equal(isPublicRemoteTarget('example.com', [{ address: '93.184.216.34' }]), true)
  assert.equal(isPublicRemoteTarget('example.com', [
    { address: '192.168.1.10' },
    { address: '93.184.216.34' },
  ]), false)
})

test('allows only HTTP(S) remote URLs', () => {
  assert.equal(parseRemoteUrl('https://example.com/image.png').protocol, 'https:')
  assert.equal(parseRemoteUrl('http://example.com/image.png').protocol, 'http:')

  for (const value of ['file:///tmp/image.png', 'ftp://example.com/image.png', '/image.png', 'not a url', 'https://user:secret@example.com/image.png']) {
    assert.throws(
      () => parseRemoteUrl(value),
      (error: unknown) => (error as { statusMessage?: string }).statusMessage === 'This image URL cannot be saved.',
    )
  }
})
