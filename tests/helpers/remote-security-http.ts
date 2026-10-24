import assert from 'node:assert/strict'
import dns from 'node:dns'
import dnsPromises from 'node:dns/promises'
import { syncBuiltinESMExports } from 'node:module'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fetchRemoteImage, remoteImageDispatcher } from '../../server/image-url.ts'

const png = await readFile(new URL('../fixtures/images/tiny.png', import.meta.url))
let internalHits = 0, lookups = 0
const server = createServer((_req, res) => { internalHits++; res.setHeader('content-type', 'image/png'); res.end(png) })
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const port = (server.address() as { port: number }).port
const oldPromise = dnsPromises.lookup, oldCallback = dns.lookup, oldFetch = globalThis.fetch
const host = 'rebinding-security.test'
const answer = () => ({ address: ++lookups % 2 ? '8.8.8.8' : '127.0.0.1', family: 4 })
// Same DNS answers for both the preflight and real socket resolver. The old fetch
// path reached localhost on lookup #2, then passed its postflight on lookup #3.
dnsPromises.lookup = (async (name, options) => name === host ? (options?.all ? [answer()] : answer()) : oldPromise(name, options)) as typeof dnsPromises.lookup
dns.lookup = ((name, options, callback) => {
  if (name !== host) return oldCallback(name, options, callback)
  const value = answer()
  queueMicrotask(() => options?.all ? callback(null, [value]) : callback(null, value.address, value.family))
}) as typeof dns.lookup
syncBuiltinESMExports()
try {
  await assert.rejects(fetchRemoteImage(`http://${host}:${port}/private.png`))
  assert.equal(lookups, 2, 'The socket must validate its own DNS lookup')
  assert.equal(internalHits, 0, 'Never send an HTTP request to the rebinding target')
  for (const ip of ['127.0.0.1', '[::1]', '[0:0:0:0:0:0:0:1]', '[::ffff:127.0.0.1]']) {
    await assert.rejects(fetchRemoteImage(`http://${ip}:${port}/private.png`))
  }
  let requests = 0
  globalThis.fetch = async () => { requests++; return new Response(null, { status: 302, headers: { location: `http://127.0.0.1:${port}/private.png` } }) }
  await assert.rejects(fetchRemoteImage('http://8.8.8.8/redirect.png'))
  assert.equal(requests, 1, 'Reject a private redirect before making another request')
  assert.equal(internalHits, 0)
  console.log('Actual socket DNS rebinding, private IPv6 and redirect boundaries passed')
} finally {
  dnsPromises.lookup = oldPromise; dns.lookup = oldCallback; globalThis.fetch = oldFetch
  syncBuiltinESMExports()
  await remoteImageDispatcher.destroy()
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
}
