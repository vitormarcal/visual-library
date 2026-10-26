import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('access boundaries, sessions, integration revocation and public image lifecycle over HTTP', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-access-'))
  try {
    const result = spawnSync(process.execPath, [new URL('./helpers/access-http.ts', import.meta.url).pathname], { cwd: directory, encoding: 'utf8', timeout: 30000 })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    const moduleUrl = new URL('../server/access-store.ts', import.meta.url).href
    const reopen = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      const store = await import(${JSON.stringify(moduleUrl)});
      const tokens = await store.listApplicationTokens();
      assert.ok(tokens.some(token => token.name === 'Blog' && !token.revokedAt));
      const { ensureDataStore } = await import(${JSON.stringify(new URL('../server/db.ts', import.meta.url).href)});
      const db = await ensureDataStore();
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM application_tokens').get().count, 3);
      assert.equal(db.prepare("SELECT publish_public_links FROM application_tokens WHERE name = 'Blog'").get().publish_public_links, 0);
      assert.ok(db.prepare('SELECT 1 FROM application_tokens WHERE publish_public_links = 1 AND revoked_at IS NOT NULL').get());
      const oldHash = await store.ownerPasswordHash();
      await store.initializeOwnerAccess({ resetKey: '22222222-2222-4222-8222-222222222222', origin: 'http://localhost' });
      assert.equal(await store.ownerPasswordHash(), oldHash);
      assert.equal((await store.ownerAccessState()).state, 'ready');
      assert.ok(db.prepare('SELECT 1 FROM images').get());
      assert.ok(db.prepare('SELECT 1 FROM image_public_links').get());
      const link = db.prepare('SELECT image_id FROM image_public_links').get();
      assert.ok(await store.publicImageLink(link.image_id));
      db.close();
    `], { cwd: directory, encoding: 'utf8', timeout: 5000 });
    assert.equal(reopen.status, 0, reopen.stdout + reopen.stderr)

  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('legacy Media Pulse credentials migrate once without reviving revoked tokens', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-token-migration-'))
  try {
    const script = `
      import assert from 'node:assert/strict';
      import { mkdirSync } from 'node:fs';
      import { DatabaseSync } from 'node:sqlite';
      import { createHash } from 'node:crypto';
      mkdirSync('data');
      const old = new DatabaseSync('data/library.sqlite');
      const token = 'vl_mp_' + 'a'.repeat(43);
      old.exec("CREATE TABLE integration_credentials (name TEXT PRIMARY KEY CHECK(name = 'media-pulse'), token_hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT)");
      old.prepare('INSERT INTO integration_credentials VALUES (?,?,?,?,NULL)').run('media-pulse',createHash('sha256').update(token).digest('hex'),'vl_mp_aaaa','2026-10-24');
      old.exec("CREATE TABLE application_tokens (id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT)");
      old.close();
      const store = await import(${JSON.stringify(new URL('../server/access-store.ts', import.meta.url).href)});
      assert.equal(await store.validApplicationToken(token), true);
      assert.equal((await store.listApplicationTokens()).length, 1);
      assert.equal((await store.listApplicationTokens())[0].publishPublicLinks, false);
      assert.equal(await store.validApplicationToken(token, true), false);
      await store.revokeApplicationToken('legacy-media-pulse');
      assert.equal(await store.validApplicationToken(token), false);
      const { ensureDataStore } = await import(${JSON.stringify(new URL('../server/db.ts', import.meta.url).href)});
      const db = await ensureDataStore();
      assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'integration_credentials'").get(),undefined);
      db.close();
    `
    const first = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: directory, encoding: 'utf8', timeout: 5000 })
    assert.equal(first.status, 0, first.stdout + first.stderr)
    const reopened = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      const store = await import(${JSON.stringify(new URL('../server/access-store.ts', import.meta.url).href)});
      assert.equal(await store.validApplicationToken('vl_mp_'+'a'.repeat(43)), false);
      assert.equal((await store.listApplicationTokens()).length, 1);
    `], { cwd: directory, encoding: 'utf8', timeout: 5000 })
    assert.equal(reopened.status, 0, reopened.stdout + reopened.stderr)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('existing application tokens retain authentication and revocation without publication after migration and restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-existing-tokens-'))
  const storeUrl = new URL('../server/access-store.ts', import.meta.url).href
  try {
    const migrate = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { mkdirSync } from 'node:fs';
      import { DatabaseSync } from 'node:sqlite';
      import { createHash } from 'node:crypto';
      mkdirSync('data');
      const old = new DatabaseSync('data/library.sqlite');
      old.exec("CREATE TABLE application_tokens (id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT)");
      const insert = old.prepare('INSERT INTO application_tokens VALUES (?,?,?,?,?,?)');
      for (const [id, suffix, revokedAt] of [['active', 'b', null], ['revoked', 'c', '2026-10-24']]) {
        const token = 'vl_app_' + suffix.repeat(43);
        insert.run(id, id, createHash('sha256').update(token).digest('hex'), token.slice(0,15), '2026-10-23', revokedAt);
      }
      old.close();
      const store = await import(${JSON.stringify(storeUrl)});
      assert.equal(await store.validApplicationToken('vl_app_' + 'b'.repeat(43)), true);
      assert.equal(await store.validApplicationToken('vl_app_' + 'b'.repeat(43), true), false);
      assert.equal(await store.validApplicationToken('vl_app_' + 'c'.repeat(43)), false);
      const tokens = await store.listApplicationTokens();
      assert.equal(tokens.length, 2);
      assert.ok(tokens.every(token => token.publishPublicLinks === false));
      assert.equal(tokens.find(token => token.id === 'active').revokedAt, null);
      assert.equal(tokens.find(token => token.id === 'revoked').revokedAt, '2026-10-24');
    `], { cwd: directory, encoding: 'utf8', timeout: 5000 })
    assert.equal(migrate.status, 0, migrate.stdout + migrate.stderr)
    const reopen = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      const store = await import(${JSON.stringify(storeUrl)});
      const active = 'vl_app_' + 'b'.repeat(43);
      assert.equal(await store.validApplicationToken(active), true);
      assert.equal(await store.validApplicationToken(active, true), false);
      assert.equal(await store.validApplicationToken('vl_app_' + 'c'.repeat(43)), false);
      assert.ok((await store.listApplicationTokens()).every(token => token.publishPublicLinks === false));
      await store.revokeApplicationToken('active');
      assert.equal(await store.validApplicationToken(active), false);
    `], { cwd: directory, encoding: 'utf8', timeout: 5000 })
    assert.equal(reopen.status, 0, reopen.stdout + reopen.stderr)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
