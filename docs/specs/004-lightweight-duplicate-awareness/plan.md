# Technical Direction

Add exact-byte duplicate prevention to the existing save route and existing save surface. Keep the implementation small and local to the current image save flow: compute a deterministic hash from the bytes being saved, compare it against stored image hashes, and skip the write/insert when the hash already exists.

Do not add dependencies. Use Node's built-in `crypto` hashing, the existing Nuxt server route, the existing SQLite database, and the existing client notice flow. Do not introduce perceptual hashing, image analysis, media pipelines, background jobs, queues, workers, generic deduplication services, or duplicate-management UI.

# Current Implementation Analysis

- `app/app.vue` owns the image list, save handlers, saving state, and lightweight notice behavior.
- `app/components/SaveDropzone.vue` is already the single unified capture surface for local upload, drag/drop, clipboard image paste, and direct image URL paste.
- `server/api/images.post.ts` already normalizes both local uploads and URL saves into `SaveImageInput` containing image bytes, original name, MIME type, and optional source URL.
- `server/db.ts` owns the minimal `images` table, existing `source_url` migration, and response mapping.
- The gallery prepends only the image record returned by a successful save.

This feature should build on that shape instead of adding separate save routes or duplicate-specific UI.

# Exact-Byte Identity Strategy

Use a cryptographic hash of the exact saved bytes as the duplicate identity.

Recommended hash:

```text
SHA-256 over the image byte buffer
```

Why:

- deterministic;
- exact-byte only;
- available through Node's built-in `crypto` module;
- no image parsing or image analysis;
- no dependency;
- practical for the current 15 MB maximum image size.

This hash represents file identity, not visual similarity. Any resized, recompressed, metadata-modified, or otherwise byte-different image is treated as a different image.

# Persistence Strategy

Add a nullable hash column to the existing `images` table:

```sql
content_hash TEXT
```

Add a partial unique index:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS images_content_hash_unique_idx
ON images(content_hash)
WHERE content_hash IS NOT NULL
```

Use a partial unique index so duplicate prevention is enforced structurally. `content_hash` remains nullable only to keep the schema tolerant while the column exists; normal new saves always write a hash.

Update `ImageRow` in `server/db.ts` to include `content_hash`, but do not expose it from `toImageResponse()`. The client does not need this value and v1 should not show duplicate identity metadata.

# Local Data Baseline

This feature assumes a fresh local testing baseline. The local data can be reset manually before testing.

For v1:

- add `content_hash TEXT` when missing;
- create the partial unique `images_content_hash_unique_idx` index;
- do not backfill existing rows;
- do not preserve historical duplicates;
- do not add cleanup, merge, review, repair, or migration workflows.

If old local data contains duplicate `content_hash` values, the unique index may require manual data cleanup or a local data reset before startup. This is acceptable for the current local testing stage.

# Save Flow Integration

Keep the duplicate check inside `server/api/images.post.ts`, after the image bytes have been validated/read and before writing a new file.

Proposed route flow:

1. Read local multipart upload or fetch URL image using the existing paths.
2. Validate MIME type and size using the existing rules.
3. Compute `contentHash = sha256(input.data)`.
4. Query SQLite for any existing row with that hash:

```sql
SELECT id FROM images WHERE content_hash = ? LIMIT 1
```

5. If a match exists:
   - do not write a file;
   - do not insert a row;
   - return a small duplicate response.
6. If no match exists:
   - write the file as today;
   - insert the row with `content_hash`;
   - return the normal image response.

The partial unique index is the structural fallback if two identical saves race past the application-level duplicate check. If the insert fails because `content_hash` is already present, delete the just-written file and return the same duplicate no-op response.

Do not query by `source_url` alone. The source URL can help explain where the image came from internally, but duplicate identity is the exact byte hash.

# API Response Shape

Return a normal success response for duplicate no-op outcomes so the client does not have to treat duplicates as errors.

Use a small union response:

```ts
type SaveImageResponse =
  | ImageRecord
  | { duplicate: true; message: 'Already saved.' }
```

On duplicate:

```json
{
  "duplicate": true,
  "message": "Already saved."
}
```

Use HTTP `200` for this v1 no-op response. Avoid `409 Conflict` because duplicate prevention is not an error or conflict in the product model.

# Client Behavior

Update `app/app.vue` save handlers to accept the union response from `/api/images`.

For both `handleSave(file)` and `handleSaveUrl(url)`:

- keep using the current `saving` state;
- if the response is a duplicate response:
  - do not prepend anything to `images`;
  - show `Already saved.` through the existing notice path;
  - use neutral/success-style notice treatment rather than error styling;
  - leave the gallery unchanged;
- if the response is an image record:
  - prepend it exactly as today;
  - show `Saved.`;
- if the request fails:
  - keep existing lightweight error behavior.

Do not change `SaveDropzone.vue`, `GalleryGrid.vue`, or `LightboxViewer.vue` unless typing requires a small prop/event adjustment. The unified save surface and gallery behavior should remain visually unchanged.

# URL-Save Duplicate Behavior

URL saves must compare the downloaded image bytes, not the URL alone.

Flow:

1. Validate and fetch the direct image URL with the existing URL-save rules.
2. Read the response body within the existing 15 MB limit.
3. Compute SHA-256 from the downloaded bytes.
4. Check for an existing `content_hash`.
5. If the hash exists, return the duplicate no-op response.
6. If the hash does not exist, save the image and store both:
   - `content_hash`;
   - original pasted `source_url`.

The same URL resolving to different bytes should create a new saved image. Different URLs resolving to identical bytes should be blocked as duplicates.

# Avoiding Repeated Hashing

For new saves, hashing the incoming bytes once is expected and acceptable because the bytes are already in memory before save.

For already-saved images:

- persist `content_hash` in SQLite;
- query the stored hash instead of reading existing files during each save;
- rely on a fresh local baseline for existing rows.

No background job is needed. No worker is needed. No media pipeline is needed.

# Failure Behavior

Duplicate outcomes:

- not an error;
- HTTP `200`;
- no file write;
- no database insert;
- no gallery mutation;
- existing notice copy: `Already saved.`;
- neutral/success-style notice treatment.

Unexpected failures:

- preserve current save failure behavior;
- show lightweight non-blocking error feedback;
- do not clear or reorder the gallery;
- if a database insert fails after a file write, keep the existing cleanup behavior that deletes the newly written file.
- if a unique `content_hash` insert fails after a file write, delete the just-written file and return the duplicate response.

# Files to Update

Update:

```text
server/db.ts
server/api/images.post.ts
app/app.vue
```

Do not add:

```text
new routes
new services
new repositories
new workers
new dependencies
duplicate-management components
```

# Risks

- Existing local data with duplicate `content_hash` values can prevent the unique index from being created. For the current local testing stage, reset local data manually rather than adding cleanup workflows.
- Existing rows without `content_hash` do not participate in duplicate detection. For the current local testing stage, reset local data manually rather than adding backfill or repair workflows.
- Concurrent duplicate saves can race past the pre-insert check, but the partial unique index prevents duplicate rows. Treat the unique constraint as the same neutral duplicate outcome.

# Out of Scope

- Perceptual hashing.
- AI similarity.
- Image analysis.
- Binary image parsing beyond existing MIME/extension validation.
- Resized or recompressed equivalence.
- Historical duplicate cleanup.
- Merge workflows.
- Duplicate review UI.
- Confirmation dialogs.
- Scroll-to-existing or highlight-existing behavior.
- Source URL as standalone duplicate identity.
- Historical duplicate cleanup for unique-index adoption.
- Backfill, repair, merge, review, or maintenance workflows.
- Queues, workers, background jobs, or media pipelines.
- Generic deduplication abstractions, service hierarchies, repositories, or provider systems.
- New dependencies.

# Manual Test Plan

- Start the app with an empty library and confirm the page loads normally.
- Save a new local image and confirm it appears in the gallery.
- Save the same local image again through upload and confirm the gallery is unchanged and `Already saved.` appears.
- Save the same image through drag/drop and confirm the gallery is unchanged and `Already saved.` appears.
- Paste the same clipboard image twice and confirm the second paste is blocked with `Already saved.`.
- Save a direct image URL, then paste the same URL again while it resolves to the same bytes and confirm the second save is blocked.
- Save a local file, then paste a URL resolving to identical bytes and confirm the URL save is blocked.
- Paste two different URLs resolving to identical bytes and confirm the second save is blocked.
- Confirm a same URL resolving to different bytes is saved as a new image when such a test fixture is available.
- Confirm duplicate attempts do not move, refresh, highlight, open, or reorder the existing image.
- Confirm duplicate feedback uses the existing notice area and is not styled as an error.
- Confirm the partial unique `images_content_hash_unique_idx` index exists.
- Confirm no source URL, content hash, duplicate badge, or duplicate-management UI appears in the gallery or viewer.
- Confirm no new dependencies were added.
