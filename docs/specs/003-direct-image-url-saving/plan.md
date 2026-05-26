# Technical Direction

Extend the existing single-page Nuxt app so the current save surface can emit either a local `File` or a pasted direct image URL. Keep the server-side save path centered on the existing `/api/images` route: local uploads continue using multipart form data, and URL saves use the same route with a small JSON body containing the pasted URL.

Do not add dependencies. Use browser clipboard APIs already available in the paste event, Nuxt `$fetch`, native server-side `fetch`, `AbortController`, Node URL parsing, Node DNS lookup, and direct filesystem/SQLite writes. Keep the implementation feature-specific and close to the existing upload code.

Avoid route changes, new import screens, downloader services, queues, workers, browser automation, scraping infrastructure, provider systems, generic media abstractions, or background processing.

# Current Implementation Analysis

- `app.vue` owns the gallery image array, loading state, notice state, delete behavior, and lightbox state.
- `SaveDropzone.vue` is the single capture surface. It already handles local image paste, drag/drop, and upload, then emits `save` with a `File`.
- `SaveDropzone.module.css` keeps the save surface compact, sticky on desktop, and visually lightweight.
- `server/api/images.post.ts` accepts multipart form data, validates allowed image MIME types/extensions, enforces a 15 MB limit, writes the file to `data/images`, inserts a row into SQLite, and returns the image record.
- `server/db.ts` owns the minimal `images` table and response mapping.
- `server/api/images.get.ts`, `server/api/images/[id].delete.ts`, and `server/routes/images/[filename].get.ts` can continue using the same image records and local file route.
- The current `ImageRecord` exposed to the client has no source URL field, which matches the v1 UI requirement that source URLs are stored internally but not displayed.

# Smallest Implementation Approach

Update only the existing capture and image-save path:

```text
app.vue
components/SaveDropzone.vue
components/SaveDropzone.module.css
server/api/images.post.ts
server/db.ts
```

Do not change:

```text
server/api/images.get.ts
server/api/images/[id].delete.ts
server/routes/images/[filename].get.ts
components/GalleryGrid.vue
components/LightboxViewer.vue
nuxt.config.ts
package.json
```

The implementation shape should be:

- Add a `save-url` event from `SaveDropzone.vue`.
- In `handlePaste`, prefer actual clipboard image files when present, preserving the current image-paste behavior.
- If no image file is present, inspect clipboard text.
- If pasted text does not reasonably look like a URL, ignore it quietly.
- If pasted text looks like a URL, emit `save-url` with the trimmed URL.
- In `app.vue`, add `saving` state or similar lightweight state for the save surface.
- Keep `handleSave(file)` for local files.
- Add `handleSaveUrl(url)` that posts JSON to `/api/images`, inserts the returned image at the front of the gallery, and uses the existing notice behavior.
- Pass the saving state into `SaveDropzone` so it can show subtle temporary copy such as "Saving image..." without adding a URL form, panel, mode, or modal.
- In `server/api/images.post.ts`, branch by request content type:
  - multipart form data: existing local upload path;
  - JSON body with `url`: direct image URL path.
- Share small constants for allowed image types, file extensions, max size, and error messages within `server/api/images.post.ts`.
- Keep save completion behavior identical: return `toImageResponse(row)` and let the client prepend it to `images`.

# Persistence Strategy

Add an internal nullable source URL column to the existing SQLite table:

```sql
source_url TEXT
```

Keep the response mapping unchanged for v1. The source URL should not be returned to the client and should not appear in gallery, viewer, tile chrome, or save-surface UI.

Use a simple migration in `ensureDataStore()`:

- continue creating the base `images` table if missing;
- inspect existing columns with `PRAGMA table_info(images)`;
- add `source_url TEXT` only if it is missing.

For local uploads, insert `source_url` as `NULL`.

For URL saves, insert the originally pasted direct image URL after validation succeeds. Store the original pasted URL, not a prettified hostname or derived bookmark record.

# URL Save Strategy

Keep URL fetching direct and bounded:

- Accept only JSON payloads shaped like `{ "url": "https://..." }`.
- Trim the URL.
- Require `http:` or `https:`.
- Reject malformed URLs and non-HTTP(S) protocols before any network request.
- Reject localhost, loopback, private, link-local, unique-local, and otherwise non-public network targets before any network request.
- Resolve hostname addresses with Node DNS lookup before fetching.
- Reject when the hostname resolves only to unsafe or non-public addresses.
- Allow the fetch to proceed when at least one usable public address exists, while still validating redirect targets before following them.
- Fetch with `redirect: 'manual'` and follow a small redirect loop directly in the route code.
- Validate each redirect target before following it.
- Limit redirects to a small fixed count, such as 5.
- Use `AbortController` with a short timeout, preferably 5 seconds and never beyond the spec's 5-10 second interactive window.
- Check `Content-Length` before reading when present.
- Read the response body stream incrementally and stop as soon as accumulated bytes exceed 15 MB.
- Validate the final response as an allowed direct image response.
- Write the downloaded bytes to `data/images` only after validation and size checks pass.
- Insert the row into SQLite after the file write, and delete the file if the insert fails.

Use the final resolved URL only for remote response validation and filename extension fallback. The stored `source_url` remains the user's original pasted URL.

# Image Type Strategy

Use the same v1 format policy as local uploads:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`
- `image/avif`

SVG remains disallowed.

Prefer validating URL responses by `Content-Type`. If the server sends a generic or missing content type, only consider a final URL extension fallback if the implementation can keep the behavior simple and still preserve the SVG boundary. Do not add binary sniffing, image parsing, or image-processing dependencies for v1.

File extension generation should remain simple:

- use the final URL pathname extension when it is one of the allowed raster extensions;
- otherwise derive from the validated MIME type;
- fall back to no extension only if necessary, matching the existing directness of the upload route.

# Client UX Strategy

Keep the capture surface unified:

- Do not add a text field.
- Do not add URL tabs.
- Do not add import modes.
- Do not add a preview.
- Do not add modal confirmation.
- Do not change routes.

The only visible copy change should be subtle, such as changing the secondary line from "Local files only" to copy that still reads image-first, for example "Paste, drop, or choose an image". While a remote URL save is in flight, show a quiet temporary saving state in the existing save surface area.

Clipboard behavior should be:

- pasted image file: save as current local image paste;
- pasted URL-looking text: attempt URL save;
- pasted non-URL text: ignore quietly;
- pasted URL that is not a supported direct image URL: show lightweight non-blocking feedback.

Drag/drop remains local image files only.

# Security-Sensitive Areas

URL saving is the sensitive part of this feature because the server fetches user-provided network targets.

Handle these areas explicitly:

- Protocol validation: allow only `http:` and `https:`.
- SSRF prevention: reject local, loopback, private, link-local, unique-local, and non-public addresses.
- Hostname validation: check literal IP hostnames and DNS-resolved addresses before fetching. Reject hostnames that resolve only to unsafe or non-public addresses; do not reject mixed results when at least one usable public address exists.
- Redirect validation: do not rely on automatic redirect following because a redirect to a private target would already make the unsafe request. Follow redirects manually and validate each `Location`.
- Redirect limits: cap redirect count to avoid loops.
- Timeout: abort remote fetches quickly so saving remains interactive and cannot hang as a background download.
- Size limits: enforce 15 MB from declared `Content-Length` and from actual bytes read.
- Content validation: accept only the approved raster image MIME types; reject SVG and HTML.
- Error messages: keep unsafe host, unsupported URL, HTML response, timeout, and fetch failures generic where appropriate, e.g. "This image URL cannot be saved."
- File cleanup: if the database insert fails after writing a downloaded file, delete the file as the local upload path already does.

Residual risk: without adding lower-level networking controls or dependencies, DNS can theoretically change between preflight lookup and the fetch connection. For this local single-user app, use best-effort DNS validation and keep the implementation simple. Do not present this as production-grade SSRF isolation.

# Accidental Complexity Risks

Avoid these tempting expansions:

- Building a reusable downloader abstraction.
- Splitting local upload and URL save into separate routes.
- Adding a visible URL input form.
- Adding source badges, hostnames, previews, or attribution UI.
- Returning `sourceUrl` to the client before a UI need exists.
- Adding OpenGraph or HTML fallback behavior.
- Adding retry systems, background queues, workers, or progress bars.
- Adding binary image sniffing or image-processing libraries.
- Adding duplicate detection.
- Adding per-host rules, allowlists, blocklists, or configuration.
- Adding a generic metadata model.

Keep the first implementation boring: paste URL, fetch once within bounds, save as an image record, show it in the gallery.

# Error Handling

Use the existing lightweight notice path.

Recommended server status behavior:

- malformed or unsupported URL: `400`
- unsafe or rejected host: `400`
- unsupported image response: `400`
- remote timeout: `408`
- image too large: `413`
- remote fetch failure: `400` or `502`

Recommended user-facing messages:

- unsafe, unsupported, malformed, failed, or non-image URL: "This image URL cannot be saved."
- oversized response: "Image is too large. Maximum size is 15 MB."
- generic unexpected failure: "Could not save this image."

Do not expose internal host validation details, resolved IPs, stack traces, or redirect chains in UI copy.

# Manual Test Plan

- Start the app and confirm the library page still opens directly.
- Paste a valid direct JPEG URL into the existing save surface and confirm it appears in the gallery after save completion.
- Paste a valid direct PNG, WebP, GIF, and AVIF URL where available.
- Paste an image from the clipboard and confirm the existing local paste behavior still works.
- Drag a local image file onto the save surface and confirm it still works.
- Use the local upload button and confirm it still works.
- Paste normal non-URL text and confirm no error appears.
- Paste a webpage URL and confirm lightweight non-blocking failure feedback appears.
- Paste an unsupported protocol URL such as `file:///tmp/image.jpg` and confirm it is rejected.
- Paste localhost and private-network URLs and confirm they are rejected.
- Paste a URL that redirects to a valid public image and confirm it saves.
- Paste a URL that redirects to localhost/private network and confirm it is rejected.
- Paste a response with `Content-Length` above 15 MB and confirm it is rejected before saving.
- Paste a response that exceeds 15 MB while reading and confirm it is rejected without leaving a saved record.
- Paste a slow URL and confirm the request times out within the short interactive timeout window.
- Confirm failed URL saves do not clear the gallery, change routes, open modals, or disable local capture after failure.
- Confirm saved URL images do not display source URL, hostname, attribution, source label, or metadata UI.
- Refresh the page and confirm URL-saved images persist.
- Delete a URL-saved image and confirm the local file and gallery record are removed.
- Confirm no new dependencies were added.
