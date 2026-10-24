import { createError, getRequestIP, setHeader, type H3Event } from 'h3'
const attempts = new Map<string, { count: number; until: number }>()
let active = 0
export function beginPasswordAttempt(event: H3Event) {
  const now = Date.now(), ip = `ip:${getRequestIP(event) ?? 'unknown'}`
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key)
  const reject = (seconds = 60): never => {
    setHeader(event, 'Retry-After', String(seconds))
    throw createError({ statusCode: 429, statusMessage: 'Try again later.' })
  }
  if (attempts.size >= 2048 && !attempts.has(ip) || active >= 2) reject()
  for (const [key, limit] of [['global', 60], [ip, 10]] as const) {
    const state = attempts.get(key) ?? { count: 0, until: now + 60_000 }
    attempts.set(key, state)
    if (++state.count > limit) reject(Math.ceil((state.until - now) / 1000))
  }
  active++
  return () => { active-- }
}
