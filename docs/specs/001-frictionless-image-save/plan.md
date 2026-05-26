# Technical Direction

Build a small single-user local Nuxt 3 app with one primary library screen. The app should make saving images feel immediate: a lightweight integrated dropzone sits above or near the masonry gallery, accepts paste, drag-and-drop, and local file selection, then stores the image and refreshes the grid after the save succeeds.

Keep the implementation direct and feature-oriented. Use Nuxt server routes for listing images, uploading images, serving saved image files, and deleting images. Avoid separate backend services, generic media pipelines, layered architecture, background processing, accounts, permissions, or remote ingestion.

Prefer concrete code close to the feature over theoretical flexibility. Do not introduce repositories, provider systems, media engines, generic storage abstractions, service hierarchies, plugin systems, or other indirection that is not required for this feature.

Be dependency-conservative. Before adding any dependency, justify why native Nuxt, Vue, browser, or Node APIs are insufficient; what exact problem the dependency solves; and whether the feature can be implemented without it. Avoid dependencies for simple state management, simple forms, basic validation, basic styling, simple file handling, generic utility functions, or UI component kits.

Prefer browser-native behavior whenever possible. Use local component state and small composables rather than global state management libraries. Handcraft the UI with CSS Modules and CSS variables; do not introduce Tailwind, utility-first frameworks, UI component frameworks, or a separate design system unless the approved feature becomes meaningfully harder without them.

# Proposed Stack

- Nuxt 3
- Vue
- TypeScript
- SQLite
- Local filesystem storage under `/data/images`
- CSS Modules
- CSS variables

# Application Structure

```
.
├── docs/specs/001-frictionless-image-save/spec.md
├── docs/specs/001-frictionless-image-save/PLAN.md
├── package.json
├── app.vue
├── assets/
├── components/
│   ├── SaveDropzone.vue
│   ├── SaveDropzone.module.css
│   ├── GalleryGrid.vue
│   └── GalleryGrid.module.css
├── server/
│   ├── api/
│   │   ├── images.get.ts
│   │   ├── images.post.ts
│   │   └── images/
│   │       └── [id].delete.ts
│   ├── routes/
│   │   └── images/
│   │       └── [filename].get.ts
│   └── db.ts
└── data/
    ├── images/
    └── library.sqlite
```

# Rendering Strategy

Render a single library page. The save surface remains visible and compact, behaving like a lightweight integrated dropzone rather than a traditional form. It supports browser-native drag-and-drop, paste, and local file input without required metadata fields. The gallery renders saved images in a dense masonry-style layout using CSS columns or a simple CSS grid approach that preserves visual density.

The first implementation may render original images directly. Do not introduce thumbnail pipelines or image processing unless manual testing shows unacceptable performance.

After a save request completes successfully, the client updates the gallery with the returned image record. The image appears immediately after successful save completion. Failure feedback appears as a small non-blocking message near the save surface or as a subtle toast, without clearing the gallery or opening a modal.

Each image tile shows only the image by default. A delete action appears on hover or keyboard focus, stays visually secondary, and removes the image after the delete request succeeds.

# Persistence Strategy

Store uploaded image files under `/data/images` with generated filenames. Store minimal metadata in SQLite at `/data/library.sqlite`.

Accept only raster image uploads in v1: JPEG, PNG, WebP, GIF, and AVIF. SVG is intentionally disallowed because it is active markup, not a simple raster image format.

Reject uploads larger than 15 MB before writing to disk or inserting metadata. This limit exists as basic upload safety, not as image processing, thumbnailing, or production-hardening scope.

Use one small table:

```
images (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
)
```

Do not build a repository layer or generic storage abstraction around this. Use small direct database helpers in `server/db.ts` only where needed by the Nuxt server routes.

No required user-provided metadata is stored. No source URL is stored because remote URL saving is out of scope for the first implementation.

# Risks

- Browser paste behavior varies by source and may not always provide image file data.
- Large local images can still affect gallery rendering below the 15 MB upload limit.
- Filesystem writes and SQLite inserts need simple error handling to avoid broken gallery state.
- The SQLite driver choice may require a dependency; it should be justified before installation because Node does not currently provide a built-in SQLite API suitable for Nuxt server routes.
- CSS masonry has tradeoffs for keyboard order and exact visual placement.
- Rendering original images directly may become slow with many or very large images, but thumbnail generation should wait until this becomes a demonstrated problem.

# Out of Scope

- Remote image URL saving or URL ingestion.
- Authentication or user accounts.
- Multi-user support.
- Sharing, social features, or collaboration.
- Cloud storage or sync.
- Queues, workers, or background processing.
- AI tagging, image analysis, or image generation.
- Tags, collections, descriptions, titles, source notes, or metadata editing.
- Duplicate detection; the same image may be saved multiple times in v1 and deduplication is intentionally deferred.
- Image editing or transformations.
- Thumbnail pipelines or image processing.
- Repositories, provider systems, media engines, generic storage abstractions, service hierarchies, plugin systems, or UI component kits.
- Tailwind, utility-first CSS frameworks, global state libraries, or separate design systems.
- Production deployment, backups, observability, or hardening work.

# Manual Test Plan

- Start the app and confirm the library page opens directly.
- Drag an image file onto the save surface and confirm it appears in the gallery after save completion.
- Paste an image from the clipboard and confirm it appears in the gallery after save completion.
- Use the local upload control and confirm the selected image appears in the gallery after save completion.
- Try a non-image file and confirm lightweight non-blocking failure feedback appears while the gallery remains usable.
- Refresh the page and confirm saved images persist.
- Hover and keyboard-focus an image tile and confirm the delete action appears subtly.
- Delete an image and confirm it is removed from the gallery.
- Confirm no title, description, tag, collection, login, or URL field is required.
- Confirm the UI follows `DESIGN.md`: visual-first masonry, warm neutral surfaces, rounded pin cards, minimal chrome, and red only for primary action emphasis.
