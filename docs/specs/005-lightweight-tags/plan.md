# Technical Direction

Add lightweight tags as a small extension of the existing image records, viewer, and gallery state. Keep capture unchanged: no tag prompts, no tag fields, and no save-flow changes.

Use the current Nuxt server routes, SQLite database, Vue local state, CSS Modules, and browser-native form behavior. Do not add dependencies, global state, routing, search infrastructure, metadata panels, tag-management screens, or generic organization abstractions.

The first implementation should stay direct:

- store optional tags for saved images;
- return image tags with the existing image list;
- let the fullscreen viewer display and edit tags inline;
- filter the existing `images` array in `app.vue`;
- show active filters above the masonry grid;
- show a small gallery-adjacent `Tags` control only after tags exist.

# Current Implementation Analysis

- `app/app.vue` owns the gallery image array, loading state, save state, notice state, delete behavior, and lightbox state.
- `SaveDropzone.vue` is the single capture surface. It must remain free of tag UI.
- `GalleryGrid.vue` renders image-only masonry tiles and emits open/delete events. It should remain tag-free in v1.
- `LightboxViewer.vue` renders the fullscreen viewer with close, previous, and next controls. This is the natural place to add quiet tag chips and inline tag editing.
- `server/db.ts` owns the minimal SQLite setup and image response mapping.
- `server/api/images.get.ts` returns the current gallery order.
- `server/api/images.post.ts` creates image records and should not require or accept tag metadata in this feature.
- The app currently has no route state, global state, search field, sidebars, or metadata panels. Tags should not introduce those patterns.

# Smallest Implementation Approach

Update:

```text
app/app.vue
app/components/LightboxViewer.vue
app/components/LightboxViewer.module.css
app/components/GalleryGrid.vue
server/db.ts
server/api/images.get.ts
server/api/images/[id].delete.ts
```

Add:

```text
app/components/GalleryTagFilters.vue
app/components/GalleryTagFilters.module.css
server/api/images/[id]/tags.put.ts
server/api/tags.get.ts
```

Do not change:

```text
app/components/SaveDropzone.vue
app/components/SaveDropzone.module.css
server/api/images.post.ts
server/routes/images/[filename].get.ts
nuxt.config.ts
package.json
```

Only touch `images.post.ts` if TypeScript response types need a shared tag-aware image shape. Do not add tags to the save request.

# Data Model

Extend SQLite with two small tables:

```sql
tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
)

image_tags (
  image_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (image_id, tag_id)
)
```

Keep this as feature-specific persistence, not a generic metadata model.

Rules:

- `name` stores the human-readable tag label after lightweight whitespace cleanup.
- `normalized_name` stores the comparison key.
- `last_used_at` updates when a tag is attached to an image.
- `image_tags.created_at` records when the tag was attached to that image.
- Deleting an image removes its `image_tags` rows.
- Tags with no image associations may remain in the `tags` table, but `GET /api/tags` should only surface tags currently attached to at least one image.

Do not add:

- tag descriptions;
- tag colors;
- tag hierarchy fields;
- tag aliases;
- metadata key/value tables;
- collection/tag unification.

# Tag Normalization

Use one small helper in `server/db.ts` or a nearby server-local helper if the file becomes crowded.

Rules:

- trim leading and trailing whitespace;
- collapse repeated internal whitespace to one space;
- lowercase for comparison;
- preserve spaces in display names;
- do not convert spaces to hyphens;
- do not parse hashtags;
- do not split on commas;
- do not merge punctuation variants.

Examples:

```text
Dark      -> display: Dark, normalized: dark
DARK      -> normalized: dark
dark      -> normalized: dark
room ideas -> normalized: room ideas
room-ideas -> normalized: room-ideas
```

When a user adds a case variant of an existing tag, reuse the existing tag row and keep the existing stored display name. Do not rename existing tags as a side effect of reuse.

# Limits

Use explicit v1 limits:

```text
max tags per image: 8
max tag length: 48 characters after whitespace cleanup
max active filters: 3
```

Validation behavior:

- Empty normalized tags are ignored or rejected quietly near the input.
- More than 8 tags on one image returns a lightweight validation error.
- Tags longer than 48 characters return a lightweight validation error.
- More than 3 active filters is prevented in the client with quiet inline or contextual feedback if needed.

Do not add complex validation systems, modal warnings, or global notices for normal tag limits.

# API Shape

## Existing Image List

Update `GET /api/images` so each image record includes tags:

```ts
type ImageTag = {
  id: string
  name: string
  normalizedName: string
}

type ImageRecord = {
  id: string
  filename: string
  originalName: string | null
  mimeType: string
  sizeBytes: number
  createdAt: string
  src: string
  tags: ImageTag[]
}
```

Keep source URLs and content hashes hidden from the client.

## Replace Tags For One Image

Add:

```text
PUT /api/images/:id/tags
```

Request:

```json
{
  "tags": ["cozy", "warm lighting"]
}
```

Response:

```json
{
  "tags": [
    { "id": "...", "name": "cozy", "normalizedName": "cozy" },
    { "id": "...", "name": "warm lighting", "normalizedName": "warm lighting" }
  ]
}
```

Behavior:

- replace the image's tag set with the submitted normalized unique set;
- preserve submitted order after normalization and deduplication where practical;
- enforce 8 tags per image;
- enforce 48 characters per tag;
- create missing tag rows;
- reuse existing tags by `normalized_name`;
- update `last_used_at` for tags attached by the request;
- return the final tag list for that image.

Use replacement rather than add/remove endpoints so the viewer can keep one small inline edit state and submit the current chip list directly.

## Tag Shortcut List

Add:

```text
GET /api/tags
```

Return only tags attached to at least one image. Include enough information for the small `Tags` control:

```ts
type TagSummary = {
  id: string
  name: string
  normalizedName: string
  imageCount: number
  lastUsedAt: string
}
```

The client should display a small mixed list leaning toward recent usage while also including common tags. Do not show counts in the UI for v1.

# Client State Strategy

In `app/app.vue`:

- keep `images` as the source array loaded from `/api/images`;
- add `activeTagFilters` as local state;
- derive `visibleImages` from `images` and `activeTagFilters`;
- pass `visibleImages` to `GalleryGrid`;
- derive viewer navigation from `visibleImages`, not from the full unfiltered array;
- when no filters are active, `visibleImages` is the full gallery order;
- keep selected viewer state by image id;
- if the selected image no longer exists in `visibleImages` after tag changes, close the viewer cleanly.

Filter behavior:

- matching is based on `normalizedName`;
- multiple active filters narrow results;
- no AND/OR UI;
- no query syntax;
- no saved filter state;
- no URL state.

When a viewer tag is clicked:

1. add that tag to active filters if not already active;
2. close the viewer;
3. show the filtered masonry gallery.

Do not change route or scroll to another page.

# Viewer Tag Editing

Extend `LightboxViewer.vue` with tag display and inline edit behavior.

Normal state:

- show quiet chips for existing tags;
- show `+ Add tag` for untagged images;
- show a small `+` affordance beside existing chips for tagged images;
- clicking an existing chip emits a filter event;
- no persistent remove controls appear.

Edit state:

- opens from `+ Add tag` or `+`;
- shows the current tags as removable chips;
- shows a small inline text input near the chips;
- typing a tag and pressing Enter adds it locally;
- spaces are allowed inside the tag;
- remove controls appear only in edit state;
- submit the current tag list to `PUT /api/images/:id/tags`;
- update the selected image's tags from the response;
- keep feedback inline near the tag input.

Validation copy:

```text
Too many tags
Tag is too long
```

Avoid:

- edit drawers;
- metadata side panels;
- dedicated Edit buttons;
- persistent open inputs;
- onboarding copy;
- modal validation.

# Gallery Filter UI

Add a small `GalleryTagFilters` component above `GalleryGrid`.

Responsibilities:

- render nothing when no active filters exist and no tag shortcut is available;
- render a slim contextual active-filter row when filters are active;
- show each active filter as a quiet chip;
- allow removing individual active filters;
- show a small `Clear` action when filters are active;
- show the small `Tags` control when at least one attached tag exists.

The `Tags` control:

- stays visually secondary;
- opens a small popover or mobile-friendly sheet;
- shows a short mixed list of recent and common tags;
- selecting a tag immediately activates the filter;
- closes after selection;
- does not show counts, analytics, alphabetical indexes, or empty states.

Keep this UI separate from the save surface.

# Masonry Grid

Keep `GalleryGrid` image-first.

Allowed changes:

- accept the already-filtered image list;
- keep existing open/delete behavior;
- keep empty copy simple when filtered results are empty.

Do not add:

- tag chips on tiles;
- hover tag overlays;
- metadata rows;
- filter controls inside image cards.

If filtered results are empty, use quiet gallery-level copy such as:

```text
No images match these tags.
```

Do not add a large empty-state panel.

# Deletion Behavior

When an image is deleted:

- delete the image file as today;
- delete associated `image_tags` rows;
- leave shared tag rows intact;
- refresh or update client state so active filters reflect the remaining images.

If the last image for a tag is deleted:

- that tag should disappear from the `Tags` control;
- active filters using that tag may remain until cleared, but the result can be empty;
- no cleanup UI is required.

# Styling Direction

Follow `DESIGN.md` and the current components.

Use:

- small rounded chips;
- warm neutral surfaces;
- subdued text;
- compact spacing;
- minimal red usage;
- no shadows beyond existing quiet overlay needs;
- no sidebar or dashboard layout.

Viewer tags should sit near existing viewer controls without competing with the image. On mobile, chips may wrap into a compact area near the bottom or top controls, but must not cover the primary image in an incoherent way.

Active filters above the gallery should be slim and quiet. They should not read as a toolbar or control panel.

# Accessibility Basics

- Tag chips that filter should be real buttons.
- Add-tag and remove-tag affordances should be real buttons.
- The tag input should have an accessible label.
- Inline validation should be announced politely when practical.
- The `Tags` control should be keyboard reachable.
- The popover/sheet should close on Escape and outside click when practical.
- Viewer keyboard navigation should continue to work.
- Typing in the tag input must not trigger viewer previous/next shortcuts.

Do not add a dependency-backed popover, combobox, or dialog system for v1.

# Risks

- Viewer controls can become visually crowded. Keep the tag area compact and test on mobile before expanding behavior.
- CSS column masonry has existing order tradeoffs. Filtering should use the same array order already used by the gallery.
- Updating tags while filters are active can remove the current image from the filtered result. Close the viewer if the selected image no longer belongs to `visibleImages`.
- A reusable tag-management abstraction would add more weight than the feature needs. Keep code feature-specific.
- The `Tags` shortcut can become a tag browser if it grows too large. Keep the returned/displayed list short.

# Out of Scope

- Capture-time tagging.
- Required tags.
- Tags in masonry tiles.
- Hover/focus tag overlays in the grid.
- Dedicated tag pages.
- Tag management screens.
- Tag descriptions.
- Tag colors.
- Nested tags.
- Tag hierarchies.
- Aliases.
- Semantic merging.
- AI tagging.
- Automatic tagging.
- Bulk editing.
- Multi-select tagging.
- General tag search.
- Saved searches.
- Query syntax.
- Smart collections.
- Sidebars.
- Metadata panels or drawers.
- Global state libraries.
- New dependencies.
- Routing changes.
- Generic metadata tables.
- Plugin/provider systems.

# Manual Test Plan

- Start the app and confirm the existing library page opens directly.
- Save a new image and confirm no tag prompt appears during capture.
- Open an untagged image in the fullscreen viewer and confirm a small `+ Add tag` affordance appears.
- Add `cozy` and confirm it appears immediately as a quiet viewer chip.
- Add `warm lighting` and confirm spaces are preserved.
- Add `Dark`, then try adding `dark`, and confirm it behaves as the same tag.
- Try adding more than 8 tags and confirm small inline feedback appears.
- Try adding a tag longer than 48 characters and confirm small inline feedback appears.
- Confirm normal viewer chips do not show persistent remove controls.
- Enter edit mode and remove a tag from the image.
- Click a viewer tag and confirm the viewer closes and the masonry gallery is filtered.
- Confirm active filters appear in a slim bar above the gallery.
- Add a second and third active filter and confirm the gallery narrows further.
- Remove one active filter and confirm results update.
- Clear all filters and confirm the normal gallery returns.
- Confirm no tags appear on masonry tiles.
- Confirm the `Tags` control is hidden before any tags exist.
- Confirm the `Tags` control appears after at least one tag exists.
- Open the `Tags` control and confirm it shows a short mixed list of recent/common tags without counts.
- Select a tag from the `Tags` control and confirm the gallery filters immediately.
- While filtered, open an image and remove the matching tag; after closing, confirm the image no longer appears in the filtered gallery.
- Delete an image with tags and confirm the image disappears and the app remains usable.
- Confirm the save surface remains visually and behaviorally unchanged.
- Confirm no dedicated tag page, sidebar, metadata panel, tag color, tag description, hierarchy, search field, or bulk edit UI appears.
- Confirm the UI remains calm and consistent with `DESIGN.md` on desktop and mobile.
