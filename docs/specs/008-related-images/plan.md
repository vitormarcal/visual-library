# Implementation: Related Images

Use the already loaded `visibleImages` in `app.vue`. A small pure utility ranks distinct candidates by shared normalized tags and existing gallery order, returning at most six. No API, schema, or dependency changes.

Pass ranked images to `LightboxViewer.vue` and handle its related-image selection by changing the current image ID while retaining the original focus-return tile and filters.

Keep a viewport-sized main viewing area inside the scrollable overlay. Add a conditional neutral masonry section below it, toggled by an accessible Related button. Preserve the main image fit and keep close fixed. Reset expansion and overlay scroll on image changes; restore focus and announce navigation. Hide related content during tag editing and keep global arrow navigation from acting on related cards.

Capture the target ID before individual tag saves. Prevent navigation while saving and apply editor response state only if the same image is still open. Restore gallery focus with `preventScroll`.

Validate ranking, exclusions, deduplication, tag identity, visible-candidate restriction, and the six-item limit with meaningful unit tests. Run the full test suite and production build. Check browser interaction if tooling is available, and record any remaining verification limitation.

## Validation Results

- `npm test`: all 14 tests passed, including shared-tag ranking, stable tie order, duplicate exclusion, exact identity, visible-candidate restriction, no-match cases, and the six-result limit.
- `npm run build`: production build passed. Existing sourcemap and `node:sqlite` externalization warnings remain.
- `git diff --check`: passed.
- Headless Chrome with an isolated temporary SQLite library: verified expansion, ranking, unchanged main-image height, related-card navigation, collapsed state and scroll reset after selection, focus on the Related action, return to the original gallery tile, absence of UI for untagged images, single-column layout at 390px, and no horizontal overlay overflow.
- Browser fixtures did not exercise delayed tag-save responses, every keyboard interaction, or physical touch gestures; these remain useful manual checks.
