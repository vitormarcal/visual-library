import { createError, getRequestIP, setHeader, type H3Event } from 'h3'
const attempts = new Map<string, { count: number; until: number }>()
let active = 0
function reject(event: H3Event, seconds = 60): never {
  setHeader(event, 'Retry-After', String(seconds))
  throw createError({ statusCode: 429, statusMessage: 'Try again later.' })
}
export function checkPasswordAttempt(event: H3Event) {
  const now = Date.now(), ip = `ip:${getRequestIP(event) ?? 'unknown'}`
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key)
  if (attempts.size >= 2048 && !attempts.has(ip)) reject(event)
  for (const [key, limit] of [['global', 60], [ip, 10]] as const) {
    const state = attempts.get(key) ?? { count: 0, until: now + 60_000 }
    attempts.set(key, state)
    if (++state.count > limit) reject(event, Math.ceil((state.until - now) / 1000))
  }
}
export function beginPasswordDerivation(event: H3Event) {
  // Reserve expensive CPU/memory only after the bounded request body is complete.
  if (active >= 2) reject(event)
  active++
  return () => { active-- }
}
