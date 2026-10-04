# Implementation: Multiple Image Save

Status: implemented following user approval on 2026-10-04. The specification and preimplementation DESIGN.md review are in [spec.md](spec.md) and [ux-review.md](ux-review.md).

## Capture and Processing

- Keep the existing `POST /api/images` endpoint: send one file per request, sequentially. No batch endpoint, durable queue, background job, server change, migration, or dependency.
- `SaveDropzone.vue` owns native multiple selection, drag/paste handling, capture focus, and disclosure presentation. Prefer DataTransfer.files; fall back to its file items only when files are absent. Never concatenate both representations or deduplicate distinct files by filename.
- Picker input resets after selection; cancellation is a no-op. Clipboard image capture continues taking one image, and URL paste continues taking one URL.
- `app.vue` owns the active-operation guard, current/total progress, and final result. Both local and URL saves share the guard. The component reports additional capture attempts while busy without starting another operation.
- `app/utils/image-upload.ts` contains file validation, error classification, sequential processing, and aggregate result formatting. Validate supported type/extension, nonempty content, and the existing 15 MB per-file limit before sending. Tests keep this limit aligned with the server.
- Insert each returned image immediately. Duplicate responses increment a neutral count. Invalid and failed files add contextual failure entries without interrupting the remaining files.
- Retry only transient failures: network errors, HTTP 408/429, and server errors. Keep previous saved/duplicate counts and permanent failures when updating the group result; repeated failure remains available for retry.
- Successful results disappear after the existing short feedback interval. Groups with failures persist until dismissal, retry, or new capture. File references are retained only as needed by the current result/attempt.
- Initial library loading merges records already saved during its pending request, avoiding loss of incremental additions when an older response arrives.

## Presentation and Accessibility

- Reuse the compact capture surface with neutral DESIGN.md colors, 16px corners, and 16px padding. Title uses body-strong; helper/progress/result use body-sm. Only the native picker trigger is primary red.
- The trigger is a native button that opens the hidden native input. Global focus-visible styling is visible on the button. Picker, disclosure, retry, and dismiss have effective targets of at least 44px.
- Use one polite atomic status area. Progress and final summary replace helper copy; do not issue per-file success notices. Independent library notices remain visible without clearing actionable group failures.
- Capture and failure feedback are sibling elements. The capture surface retains desktop sticky behavior and phone normal flow. Failure actions appear before the collapsed details/list, so users do not have to traverse a large expanded list to retry or dismiss.
- Expanded failure details stay in ordinary document flow with wrapping filenames and no nested scrollbar. Retry is secondary, dismiss/disclosure tertiary, and only failure explanations use the existing semantic error color.
- On phones, reserve two helper-text lines to reduce changes between idle, progress, and result states. Long feedback may still wrap naturally instead of being clipped.
- Retry temporarily focuses the surviving capture surface; after the picker is enabled, restore focus if the user has not moved elsewhere. Dismiss returns focus to the picker without scrolling. Saving never steals focus from gallery/viewer interactions.
- Timers are cleared on component teardown. No new settings or display modes.

## Files

Modify `app/app.vue`, `SaveDropzone.vue`, its CSS Module, and the existing global CSS token mapping for DESIGN.md's error color. Add `app/utils/image-upload.ts` and `tests/image-upload.test.ts`. Update feature documents and the backlog; retain existing capture/duplicate/URL boundaries.

## Validation — 2026-10-04

- `npm test`: all 24 tests passed. New tests exercise mixed groups, sequential requests, partial success, permanent/transient failures, retry aggregation without mutating previous results, shared size limits, transfer representations, distinct same-name files, and zero-count omission.
- `npm run build`: passed; existing sourcemap and `node:sqlite` externalization warnings remain.
- `git diff --check`: passed.
- Headless Chrome with an isolated temporary SQLite library and synthetic raster files verified native multiple selection, immediate gallery updates, duplicates, oversized/empty/unsupported files, an intercepted 503 failure, continued processing, busy drop/URL guards, and gallery/viewer use during a held upload request.
- Verified repeated failed retry, eventual recovery, aggregate counts, no retry for permanent failures, persistent error feedback, focus return, same-file reselection, picker reset, single-image clipboard behavior, single-URL paste behavior, and reload persistence. URL frontend behavior used an intercepted response; server URL validation remains covered by existing tests.
- Verified combined search/exact-filter context and a held initial library response arriving after a successful upload. The later response preserves the newly saved image.
- Verified keyboard activation of the native `selectMultiple` picker, visible focus, and cancellation without a new save.
- At 320/390px phones, tablet, and 1280px desktop, a group of 20 failures with long filenames has no horizontal overflow, nested scrolling, or growing sticky panel. Capture height remains unchanged when details expand; controls meet 44px targets. Desktop/mobile screenshots were visually inspected.
- No uncaught browser exceptions. Tests never mutate the user's saved library.

Physical touch/file-picker behavior, assistive-technology announcement quality, and real collections remain useful manual checks. Saving does not resume across reloads, and sequential processing prioritizes predictable behavior over maximum throughput.
