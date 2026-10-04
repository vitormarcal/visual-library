# Implementation Plan: Connected Browsing

Status: implemented following user authorization on 2026-10-04. Validation results are recorded below.

## Starting Constraints

`app.vue` derives the selected image from `visibleImages`, computes related candidates from the same array, and closes the viewer in its visible-results watcher. Merely passing all images to the matcher would still prevent opening an out-of-filter candidate. Viewer state and gallery navigation must be separated together.

`LightboxViewer.vue` resets scroll and focus whenever its image ID changes. Back restoration must coordinate with this watcher instead of competing with it. Preserve the recent Tags ↓ cue and reduced-motion handling.

## 1. Separate Viewer Identity from Gallery Order

- Resolve `selectedImage` by ID from `images`; continue computing gallery index and adjacent availability from `visibleImages`.
- Pass the full `images` array to related matching. Keep the current matching helper's ranking, deduplication, and six-result limit.
- Keep selection pruning in the visible-results watcher but remove its viewer-close condition. Watch full library existence instead.
- Preserve search/filter state on open, related navigation, Back, and close. During individual viewer edits, stop pruning active filters. Keep deletion pruning unchanged.
- Introduce a shared session cleanup path for close, successful viewer filtering, and missing-current-image fallback. Preserve the originating gallery tile ID separately from the currently viewed image.
- Add a stable search focus target and use it when the originating tile is absent, always with `preventScroll`.

## 2. Add Temporary Excursion History

Keep a feature-specific stack in `app.vue`. Each entry records the departed image ID, viewer scroll offset, and a small focus descriptor (related-card image ID or named viewer control). Store IDs, not image-record snapshots, so revisits show confirmed edits.

- Start recording on the first related choice. No history for ordinary gallery arrows before that choice.
- Once the stack is active, record successful adjacent navigation and related choices. Reject missing destinations and same-ID transitions before pushing.
- Back removes the newest surviving entry, requests restoration, and does not push the departed image. Returning to an empty stack ends the excursion.
- Clear state on close/new session/successful filter selection. Skip missing IDs while popping; missing-current-image recovery uses the same restoration path.
- No router, browser history, storage, global state library, or generic navigation engine.

Use a small pure helper in `app/utils/viewer-history.ts` only for stack transition behavior requiring unit coverage. Keep DOM and focus details inside the existing Vue component.

## 3. Coordinate Component Navigation and Restoration

- Add navigation events carrying the departing viewer position for related/adjacent choices and a Back event. Pass `canGoBack` and a one-use restoration request with a transition token.
- In the image watcher, make ordinary reset and Back restoration mutually exclusive. After DOM update, restore the requested scroll/focus or perform the existing top reset and announcement.
- Account for lazy related images changing section height: establish restoration after target image layout is available, preserve natural ratios, and bound any layout correction to the active transition. Cancel stale work when navigating again or unmounting.
- Restore focus by stable card/control descriptors, with `preventScroll`. If a card disappeared after editing, fall back to a surviving control while retaining restored scroll.
- Keep Back fixed in the existing top reserve opposite close; include it in the keyboard focus loop. Rename the related-section scroll return to `Back to main image ↑`.
- Block Back alongside existing related/adjacent navigation during tag saves. Route keys and buttons through the same guarded handlers.
- Keep the tag-save request and confirmed library update in app.vue through a save callback, so completion survives viewer unmount. Track pending image IDs and disable editing/navigation when the same image is reopened before completion. The viewer only updates its local draft if still mounted on the originating image. Restoration uses a transition version, canceled on new navigation/unmount.

## 4. Explain Connections Quietly

- Derive shared display tags in current-image order using exact normalized identity; show the first and an additional-count suffix.
- Add a plain caption below each related image within its existing button and an accessible name covering the image and connection.
- Change section context to `Shared tags · Entire library`.
- Keep captions scoped to related cards, not gallery tiles. Reuse DESIGN.md color, spacing, type, and radius tokens; preserve sparse layouts and lazy loading.

## 5. Validation

Unit tests should cover actual behavior: full-library candidates outside visible results; stable matching/caption identity; excursion start after ordinary arrows; adjacent transitions during an excursion; repeated-image paths; same-ID no-op; Back without push; missing-entry skipping; and session reset. Retain existing matching/search/persistence tests.

Browser checks with isolated fixtures, without modifying the user's saved library:

- Filtered A → B → C across different tags, return to B's chosen card/scroll, return to A, and close to the original gallery tile.
- Excursion starting after A → D ordinary gallery arrows; Back returns to D while close returns focus to A.
- Branching after Back and A → B → A revisits; no artificial candidate suppression.
- Arrows inside/outside gallery results, tag editing that removes a search match, explicit viewer filtering, filter-limit rejection, no-related-image paths, missing history IDs, and disappeared focus targets.
- Slow tag saves, closing/reopening during a save, rapid navigation, lazy image layout, and stale restoration cancellation.
- Keyboard focus loop and announcements, pointer focus, reduced motion, 320/390px phones, landscape phone, tablet, 1280/1920px desktop, long tag captions, and safe-area control placement.
- Measure main image bounds before/after to establish that the Back control does not consume image area. Visually inspect screenshots and report physical-device checks separately.

Run `npm test`, `npm run build`, and `git diff --check` after implementation. Documentation-only planning does not establish feature validation.

## Files and Delivery

Modify `app/app.vue`, `app/components/LightboxViewer.vue`, its CSS Module, and the search input focus target in `GalleryTagFilters.vue`. Add the small history helper/tests if needed for the specified transition coverage; extend related tests for connection captions. No server or database changes.

Deliver viewer decoupling, full-library related matching, Back restoration, and connection captions together so users can leave filtered results and safely retrace the choice. After validation, update 005/006/008/009 references for changed boundaries and BACKLOG.md with actual implementation/usage status. Do not mark this proposal implemented or validated before those checks.


## Implementation Validation — 2026-10-04

- `npm test`: all 19 tests passed, including full-library connections, exact connection captions, excursion start, adjacent transitions, revisits/branching, same-image no-op, immutable Back, and missing-history skipping.
- `npm run build`: passed. Existing sourcemap and `node:sqlite` externalization warnings remain.
- `git diff --check`: passed.
- Headless Chrome with a temporary isolated SQLite library verified A → B → C outside a search, Back restoring the triggering card and scroll, excursion start after ordinary arrows, revisits/branching, explicit viewer filtering and history reset, three-filter-limit rejection retaining the viewer and excursion, edits leaving search results without closing, fallback focus to search, and gallery scroll preservation.
- Verified combined exact tag filtering and filename search remain unchanged after an excursion. Real keyboard events verified adjacent arrows, retracing arrow transitions during an excursion, Escape, and the Tab/Shift+Tab focus loop. Untagged images retain the Tags ↓ cue and omit related content.
- An intercepted delayed tag-save request verified disabled Back/related/arrow navigation, pending state after reopening the same image, and completion updating only the originating image while a different image is open.
- At 320 × 568, 390 × 844, 844 × 390, 768 × 1024, 1280 × 900, and 1920 × 1080, measured identical main-image dimensions before/after the Back control, no horizontal overflow, and separate controls with targets of at least 44px. Related-section shortcut headings stay below fixed controls. Desktop/mobile synthetic screenshots were visually inspected; mobile heading overlap and pale image-corner artifacts were corrected.
- Previously loaded related-image dimensions are retained only for the current viewer session to reserve image space on Back. Restoration briefly corrects layout shifts for up to two seconds; pointer, wheel, touch, or keyboard input immediately takes over. Each navigation/unmount cancels previous restoration work.
- No dependencies, routes, server changes, or database changes. History contains only IDs, scroll offsets, and stable focus descriptors, and is discarded on exit.
- Physical touch/safe areas, extremely slow uncached images beyond the correction window, and aesthetic evaluation with the real collection remain manual checks. Synthetic browser fixtures do not establish actual-use benefit.
