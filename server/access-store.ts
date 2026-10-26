import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { ensureDataStore } from './db.ts'

const derive = promisify(scrypt)
export const digestSecret = (value: string) => createHash('sha256').update(value).digest('hex')
const secret = () => randomBytes(32).toString('base64url')
export class AccessError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export type AccessConfig = { resetKey: string; origin: string }
export function validateAccessConfig(input: AccessConfig): AccessConfig {
  if (input.resetKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.resetKey)) throw new Error('OWNER_RESET_KEY must be a UUID')
  let url: URL
  try { url = new URL(input.origin) } catch { throw new Error('Set NUXT_LIBRARY_ORIGIN to the canonical HTTPS origin') }
  if (url.origin !== input.origin || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('NUXT_LIBRARY_ORIGIN must be an HTTPS origin (HTTP allowed only on localhost)')
  }
  return input
}

type OwnerRow = { password_hash: string | null; setup_generation: string | null }
export async function initializeOwnerAccess(config: AccessConfig) {
  const db = await ensureDataStore()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('INSERT OR IGNORE INTO owner_credentials (id) VALUES (1)').run()
    if (config.resetKey) {
      const hash = digestSecret(config.resetKey.toLowerCase())
      if (!db.prepare('SELECT 1 FROM owner_reset_commands WHERE key_hash = ?').get(hash)) {
        db.prepare('UPDATE owner_credentials SET password_hash = NULL, setup_generation = ? WHERE id = 1').run(randomUUID())
        db.prepare('DELETE FROM owner_sessions').run()
        db.prepare('INSERT INTO owner_reset_commands (key_hash, applied_at) VALUES (?, ?)').run(hash, new Date().toISOString())
      }
    }
    db.prepare('DELETE FROM owner_sessions WHERE expires_at <= ?').run(Date.now())
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
}
export async function ownerAccessState() {
  const db = await ensureDataStore()
  const row = db.prepare('SELECT password_hash,setup_generation FROM owner_credentials WHERE id = 1').get() as OwnerRow | undefined
  return { state: row?.password_hash ? 'ready' : row?.setup_generation ? 'setup' : 'blocked', generation: row?.setup_generation ?? null }
}
export async function ownerPasswordHash() {
  const db = await ensureDataStore()
  const row = db.prepare('SELECT password_hash FROM owner_credentials WHERE id = 1').get() as OwnerRow | undefined
  return row?.password_hash ?? null
}
export async function verifyOwnerPassword(password: string, hash: string) {
  const [, salt, expected] = hash.split('$')
  const actual = await derive(password, salt!, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }) as Buffer
  return timingSafeEqual(actual, Buffer.from(expected!, 'hex'))
}
export async function defineOwnerPassword(password: unknown, confirmation: unknown, generation: unknown) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024 || confirmation !== password || typeof generation !== 'string') {
    throw new AccessError(400, 'Use matching passwords of 12–1024 characters.')
  }
  const state = await ownerAccessState()
  if (state.state !== 'setup' || state.generation !== generation) throw new AccessError(409, 'Password setup is no longer available. Reload to sign in.')
  const salt = randomBytes(16).toString('hex')
  const key = await derive(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }) as Buffer
  const hash = `scrypt-v1$${salt}$${key.toString('hex')}`
  const db = await ensureDataStore()
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = db.prepare('UPDATE owner_credentials SET password_hash = ?, setup_generation = NULL WHERE id = 1 AND password_hash IS NULL AND setup_generation = ?').run(hash, generation)
    if (!result.changes) throw new AccessError(409, 'Password setup is no longer available. Reload to sign in.')
    db.prepare('DELETE FROM owner_sessions').run()
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
}
export async function createOwnerSession(expectedHash: string) {
  const db = await ensureDataStore(), now = Date.now(), token = secret()
  // Revalidate after async password derivation: a reset may have happened meanwhile.
  const result = db.prepare(`INSERT INTO owner_sessions (token_hash, created_at, expires_at, password_fingerprint)
    SELECT ?, ?, ?, ? FROM owner_credentials WHERE id = 1 AND password_hash = ?`)
    .run(digestSecret(token), now, now + 30 * 86400_000, digestSecret(expectedHash), expectedHash)
  if (!result.changes) throw new AccessError(401, 'Password changed. Sign in again.')
  return token
}
export async function hasOwnerSession(token: string | undefined) {
  if (!token || !/^[\w-]{43}$/.test(token)) return false
  const hash = await ownerPasswordHash()
  if (!hash) return false
  const db = await ensureDataStore()
  return Boolean(db.prepare('SELECT 1 FROM owner_sessions WHERE token_hash = ? AND expires_at > ? AND password_fingerprint = ?')
    .get(digestSecret(token), Date.now(), digestSecret(hash)))
}
export async function deleteOwnerSession(token: string) {
  const db = await ensureDataStore()
  db.prepare('DELETE FROM owner_sessions WHERE token_hash = ?').run(digestSecret(token))
}
export async function listApplicationTokens() {
  const db = await ensureDataStore()
  return db.prepare(`SELECT id,name,prefix,created_at AS createdAt,revoked_at AS revokedAt,publish_public_links AS publishPublicLinks FROM application_tokens ORDER BY created_at DESC,id`).all().map(row => ({ ...row, publishPublicLinks: Boolean(row.publishPublicLinks) }))
}
export async function createApplicationToken(name: unknown, publishPublicLinks: unknown = false) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw new AccessError(400, 'Enter an application name of up to 80 characters.')
  if (typeof publishPublicLinks !== 'boolean') throw new AccessError(400, 'Public link permission must be a boolean.')
  const token = `vl_app_${secret()}`, db = await ensureDataStore(), id = randomUUID(), createdAt = new Date().toISOString()
  db.prepare('INSERT INTO application_tokens (id,name,token_hash,prefix,created_at,publish_public_links) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name.trim(), digestSecret(token), token.slice(0, 15), createdAt, publishPublicLinks ? 1 : 0)
  return { id, name: name.trim(), prefix: token.slice(0, 15), createdAt, revokedAt: null, publishPublicLinks, token }
}
export async function revokeApplicationToken(id: string) {
  const db = await ensureDataStore()
  const result = db.prepare('UPDATE application_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?').run(new Date().toISOString(), id)
  if (!result.changes) throw new AccessError(404, 'Credential not found.')
}
export async function validApplicationToken(token: string, requirePublicLinks = false) {
  if (!/^vl_(?:app|mp)_[\w-]{43}$/.test(token)) return false
  const db = await ensureDataStore()
  return Boolean(db.prepare('SELECT 1 FROM application_tokens WHERE token_hash = ? AND revoked_at IS NULL AND (? = 0 OR publish_public_links = 1)').get(digestSecret(token), requirePublicLinks ? 1 : 0))
}
export async function publicImageLink(imageId: string, create = false) {
  const db = await ensureDataStore()
  if (!db.prepare('SELECT 1 FROM images WHERE id = ?').get(imageId)) throw new AccessError(404, 'Image not found.')
  if (create) db.prepare('INSERT INTO image_public_links (image_id, token, created_at) VALUES (?, ?, ?) ON CONFLICT(image_id) DO NOTHING')
    .run(imageId, secret(), new Date().toISOString())
  const row = db.prepare('SELECT token FROM image_public_links WHERE image_id = ?').get(imageId) as { token: string } | undefined
  return row ? `/shared-images/${row.token}` : null
}
export async function revokePublicImageLink(imageId: string) {
  const db = await ensureDataStore()
  db.prepare('DELETE FROM image_public_links WHERE image_id = ?').run(imageId)
}
