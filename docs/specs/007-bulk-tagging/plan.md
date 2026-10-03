# Implementation Plan: Bulk Tagging

## Direction

Extend the existing gallery, local Vue state, Nuxt routes, and SQLite tag tables. No new dependencies, migrations, global state, management pages, or generic bulk-action framework.

The approved spec is `spec.md`. Tags remain freeform personal memory cues. Implement addition only; do not expose tags shared by the selected images or partial coverage.

## Current Implementation

- `app/app.vue` owns images, search, tag filters, visible images, and viewer state.
- `GalleryGrid.vue` renders native tile buttons and a separate remove action.
- `LightboxViewer.vue` already provides normalization, tag suggestions, and inline editing, but saves each change immediately through a replacement endpoint.
- `server/db.ts` owns tag normalization, limits, response mapping, and SQLite transactions.
- `PUT /api/images/:id/tags` replaces one image's tags. Calling it repeatedly cannot guarantee all-or-nothing group updates.

## Gallery Selection

Keep selection mode and selected image IDs in `app.vue`. Derive selected images from `visibleImages` and prune selected IDs whenever visible results change. Exiting mode clears selection and drafts.

Pass selection mode, selected IDs, and saving state to `GalleryGrid`. In selection mode, tile buttons toggle selection instead of opening the viewer, expose `aria-pressed`, and show a compact check indicator and neutral selection outline. Hide the remove action in this mode. Preserve masonry proportions and normal tile behavior outside selection mode.

Add a small gallery-adjacent `Select` action. While selection is active, show count, `Select all`, `Add tags`, and `Done`. Select-all takes exactly the currently visible IDs. Disable tag entry when nothing is selected. Do not add shift-range selection or unrelated bulk actions.

## Contextual Tag Entry

Add `GalleryBulkTags.vue` and its CSS Module for the compact selection controls and inline tag form, following current neutral chips and inputs. Keep selection and request ownership in `app.vue`; keep input, pending tag chips, and suggestion filtering local to the component.

Reuse the viewer's established tag-entry behavior conceptually: clean whitespace, compare lowercase keys, Enter confirms a whole phrase, offer at most five matching existing tags, and reuse existing display names. Avoid extracting a general editor system for these two flows.

Draft chips represent only tags to add. Removing a draft chip affects pending input only. `Apply` submits the draft list once; include any nonempty current input through the same validation so typed text is not silently lost. `Cancel` discards drafts and keeps selection. On success clear drafts and selection while staying in selection mode. On failure retain both.

Use accessible input labels and polite status feedback. Return focus to a relevant selection control after cancel or success. During the request disable selection changes, search/filter interactions, and exits that would discard pending work; restore them when it finishes. Support Escape to cancel tag entry, or exit selection mode when the editor is closed, without intercepting normal browsing shortcuts.

## Atomic Add Endpoint

Add `POST /api/images/tags` with body `{ imageIds: string[], tags: string[] }`. Return `{ images: Array<{ id: string, tags: ImageTag[] }> }` containing final tags for each requested image.

Validate arrays, string types, nonempty unique image IDs, and a nonempty normalized tag list. Reuse current eight-tag and 48-character limits and tag normalization. Missing images return a contextual error with no group changes.

Add a feature-specific `addTagsToImages` function in `server/db.ts`:

1. Normalize and deduplicate requested tags and image IDs.
2. Begin one SQLite transaction. Verify every image exists and calculate the union of current and requested tags for every image.
3. Validate every union before writing anything. Exceeding any image's limit fails the entire request.
4. Resolve or create requested tag rows, preserving existing display names.
5. Insert only missing image/tag associations; preserve all existing associations and timestamps. Update tag usage timestamps only for tags newly attached by this operation. A fully redundant request is a quiet no-op.
6. Read final tags, commit, and return them. Roll back on any error.

Do not call `replaceImageTags` inside this transaction: it starts its own transaction and deletes existing associations. Keep the existing single-image replacement endpoint unchanged.

## Client Updates and Feedback

`app.vue` sends one request using a snapshot of selected IDs and pending tag names. Apply returned tags to `images` in one update, clear selection, and refresh tag summaries once. Existing computed gallery filters then reflect final tags immediately.

Map validation failures to brief inline copy such as `Tag is too long` or `Some images would exceed 8 tags`. Missing images and other failures preserve pending work and offer retry. Show short success feedback in the selection area, not the capture notice.

## Files

Modify:
- `app/app.vue`
- `app/components/GalleryGrid.vue`
- `app/components/GalleryGrid.module.css`
- `server/db.ts`

Add:
- `app/components/GalleryBulkTags.vue`
- `app/components/GalleryBulkTags.module.css`
- `server/api/images/tags.post.ts`
- `tests/bulk-tagging.test.ts`

Keep save flows, viewer tag editing, existing image routes, dependencies, and database schema unchanged.

## Validation

Use an isolated temporary library for database tests; never mutate the user's saved library. Test real persistence behavior: additive updates on multiple images, preserving unrelated tags and associations, case-insensitive deduplication and display-name reuse, repeated-request no-op, per-image limit failure with no partial writes, missing-image failure, and rollback. Include invalid request shapes in route validation checks where practical.

Run `npm test` and `npm run build`.

Manually verify desktop and mobile selection, keyboard toggling and focus, select-all under search and combined tag filters, pruning hidden selections, adding two tags together, draft cancellation, retry after failure, reload persistence, and returning to normal lightbox browsing. Review against the approved spec, constitution, and design rules: contextual controls, image dominance, no display of tags shared by the selection, no permanent metadata on tiles, and no dependency growth.

## Implementation Validation

- `npm test`: all 10 tests passed, including an isolated SQLite persistence test for additive group updates, existing associations, display-name reuse, redundant requests, limit validation, missing images, and rollback after a write failure.
- `npm run build`: production build completed.
- `git diff --check`: passed.
- Code review against the approved scope: existing tag associations are preserved; no dependencies or schema changes; selection controls remain contextual; tags shared by the selected images and unrelated bulk actions are absent.
- Browser interaction checks remain pending: this environment has no browser tool. A temporary HTTP smoke test could not start its local listening socket in the restricted environment.
