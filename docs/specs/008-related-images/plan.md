# Implementation: Related Images

Current matching scope, temporary Back state, and connection captions are extended by [010](../010-connected-browsing/plan.md). The original implementation/validation below records feature 008.

## Data and State

Use `visibleImages` already loaded in `app.vue`. `app/utils/related-images.ts` ranks distinct candidates by shared normalized tags, breaking ties by current gallery order and limiting results to six. No API, schema, or dependency changes.

Pass candidates to `LightboxViewer.vue`; its selection event changes the image ID while retaining search, filters, original focus-return tile, and adjacent gallery navigation.

Capture the target ID before individual tag saves. Prevent navigation during saving and apply editor response state only if the same image remains open. Restore gallery focus with `preventScroll`.

## Continuous Viewer

Keep a viewport-sized main area in one scrollable overlay. Render the related section whenever confirmed matches exist and tagging is not being edited. There is no expansion state.

Place Explore related in the image navigation row, separate from previous/next; tags follow the viewport stage in normal flow, as defined in [009](../009-viewer-image-fit/plan.md). Its shortcut scrolls to the section and focuses the heading for keyboard activation or the section container for pointer activation. Back to image scrolls to the top without hiding the section. Respect reduced motion. On image changes reset scroll, announce the image, and restore a valid viewer focus target.

Keep close fixed with a 44px target. Preserve the focus loop, including programmatically focused destinations, and prevent global arrow navigation from acting on related content.

## Presentation

Follow DESIGN.md: continuous dark viewing surface, neutral tertiary actions, 18px section heading, quiet 14px contextual copy, 16px full-bleed image cards, 8px gutters, and no extra panel chrome.

Use a maximum 960px section width. General masonry has three desktop columns, two tablet columns, and one narrow-phone column. Sparse content uses a capped single column or two explicit aligned columns; pair layout collapses on phones. Reserve header space for fixed close and use lazy image loading.

## Validation

- All 14 unit tests pass, including shared-tag ranking, stable ties, duplicate exclusion, exact identity, visible-candidate restriction, no-match behavior, and six-result limit.
- Production build and `git diff --check` pass. Existing sourcemap and `node:sqlite` externalization warnings remain.
- Headless Chrome with isolated SQLite fixtures verifies continuous content before shortcut activation, heading focus for keyboard, container focus for real pointer clicks, back scroll without hiding, related-card navigation, original tile focus return, no-match UI omission, one/two/six-result layouts, mobile overflow, reduced motion, and 44px close target.
- Desktop/mobile screenshots with synthetic images were visually inspected; sparse two-image distribution and gallery interference were corrected.
- Physical touch, the full range of real image ratios/long tag labels, and delayed tag-save responses remain useful manual checks. Synthetic fixtures do not establish final aesthetics with the user's collection.

## Design Rationale

See [ux-review.md](ux-review.md) for official competitor references and the approved refinement. The original hidden expansion and subsequent automatic-reveal fix are replaced by continuous related content with explicit scroll shortcuts.
