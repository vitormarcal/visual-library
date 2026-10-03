# Implementation: Lightweight Tags

## Boundaries

Use the existing Nuxt routes, SQLite database, local Vue state, and CSS Modules. Keep capture free of tag metadata. No new dependencies, global state library, generic metadata framework, or tag-management pages.

This document covers shared persistence and individual viewer editing. Gallery discovery is specified in [006](../006-library-search/plan.md); additive group updates are specified in [007](../007-bulk-tagging/plan.md).

## Persistence and Normalization

`server/db.ts` owns tag normalization, limits, response mapping, and transactions.

- `tags` stores `id`, `name`, unique `normalized_name`, `created_at`, and `last_used_at`.
- `image_tags` stores `image_id`, `tag_id`, and `created_at`, with a composite primary key.
- Trim and collapse whitespace; lowercase for identity while preserving the first stored display name.
- Preserve phrases and punctuation. Do not split commas or merge aliases.
- Deduplicate normalized values and enforce eight tags per image and 48 characters per tag.
- Deleting an image removes its associations. Unattached tag rows may remain but are excluded from discovery.

## API

- `GET /api/images` includes each image's tags as `{ id, name, normalizedName }`. Load associations together and group them by image ID. Do not expose source URLs or content hashes.
- `GET /api/tags` returns every attached tag with `imageCount` and `lastUsedAt`, without a short-list limit. Gallery ranking and display belong to feature 006.
- `PUT /api/images/:id/tags` accepts `{ "tags": ["playboy", "mel lisboa"] }`, validates the image and string array, and replaces that image's set in one transaction. Return `{ tags: ImageTag[] }`.
- Individual replacement preserves normalized submitted order and reuses existing display names. It updates usage timestamps for tags in the submitted set.
- Group addition uses the separate endpoint in feature 007; do not implement it through repeated individual replacement requests.

## Client Behavior

`app/app.vue` owns images, active tag filters, search, and the viewer image ID. Derive `visibleImages` from search and exact tag filters; viewer navigation follows this array.

`LightboxViewer.vue` owns its inline editor. Each confirmed addition or removal submits the current list through the replacement endpoint. Show at most five matching existing tags as optional suggestions. Keep errors near the input and disable editing inputs while saving.

Done and Escape close editing without undoing saved changes. Normal viewer chips request gallery filtering. Close the viewer after successful filter selection; retain it with feedback if the three-filter limit prevents selection.

Update image tags from responses and refresh tag summaries. After individual edits or deletion, prune filters whose tags are no longer attached anywhere. Close the viewer when the selected image leaves `visibleImages`.

## UI and Accessibility

Use quiet chips and compact inline inputs following `DESIGN.md`. Keep metadata off gallery tiles and capture controls. Use native buttons, an accessible input label, contextual status messages, and keyboard access. Typing in the editor must not trigger previous/next shortcuts.

## Validation

- Test normalization, case-insensitive deduplication, empty values, and limits.
- Verify individual addition, removal, display-name reuse, immediate saving, and reload persistence.
- Verify viewer filtering, the three-filter limit, filter pruning, and an edited image leaving visible results.
- Verify keyboard behavior and desktop/mobile layout.
- Run `npm test` and `npm run build` when implementation changes. Documentation updates alone do not establish browser validation.
