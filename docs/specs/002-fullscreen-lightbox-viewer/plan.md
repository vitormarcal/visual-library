# Technical Direction

Implement the lightbox as a small, feature-specific client-side overlay on the existing Nuxt library screen. Keep the masonry gallery as the source of truth and the primary browsing surface; the viewer should only present the currently selected image above the current page.

Use Vue local state, existing image records, existing image routes, CSS Modules, and browser-native events. Do not add dependencies. Do not introduce animation libraries, global state, generic modal/dialog infrastructure, routing changes, image detail pages, image processing, or metadata surfaces.

The implementation should stay direct:

- `GalleryGrid` emits an open event when a tile image is activated.
- `app.vue` stores the selected image id or index and passes the selected image plus navigation availability into a lightbox component.
- A feature-specific `LightboxViewer` renders the fullscreen overlay, image, close control, and previous/next controls.
- CSS handles the overlay, centered image sizing, sparse controls, and a short lightweight transition if used.

# Application Structure Changes

Add:

```text
components/LightboxViewer.vue
components/LightboxViewer.module.css
```

Update:

```text
app.vue
components/GalleryGrid.vue
components/GalleryGrid.module.css
```

Do not change:

```text
server/
data/
nuxt.config.ts
package.json
```

No API, database, storage, dependency, or route changes are needed. The viewer should use the same `ImageRecord.src` values already rendered by the gallery.

# Viewer State Strategy

Keep viewer state in `app.vue`, alongside the existing `images` state. Store the selected image by id or by index derived from the current `images` array. Prefer the simplest version that keeps navigation correct after saves and deletes.

The viewer is open when a selected image exists. Closing clears that selected value. The gallery remains mounted behind the overlay so scroll position is naturally preserved.

If the selected image is deleted or no longer exists in the current `images` array, close the viewer rather than trying to recover with extra state.

Do not use URL state, query params, route params, local storage, session storage, a global store, or a reusable modal registry.

# Navigation Strategy

Navigate through the current `images` array order, matching the order the gallery already receives from `/api/images`.

Previous image:

- Available when the selected image index is greater than `0`.
- Disabled or hidden when the selected image is first.

Next image:

- Available when the selected image index is less than `images.length - 1`.
- Disabled or hidden when the selected image is last.

Support both visible controls and keyboard navigation:

- `Left Arrow` selects the previous image when available.
- `Right Arrow` selects the next image when available.
- `Escape` closes the viewer.
- The first implementation does not include swipe gestures.
- Touch interaction uses the same explicit controls as pointer interaction.

Click behavior:

- Clicking the darkened overlay closes the viewer.
- Clicking the image does not close the viewer.
- Clicking previous, next, or close controls does not close through overlay bubbling.

# Accessibility Basics

Use practical accessibility without building a full dialog system.

Minimum behavior:

- The selected grid image can be opened by mouse and keyboard.
- Image tiles expose a button-like activation target or equivalent keyboard handling.
- The viewer has a clear accessible label.
- Close, previous, and next controls are real buttons with accessible names.
- Keyboard handlers work while the viewer is open.
- Focus moves to the viewer or close control on open when practical.
- Focus returns to the originating tile after close when practical.
- Body scroll may be prevented while the viewer is open if the overlay otherwise allows background scrolling.

Avoid overengineering:

- No generic focus-trap package.
- No dependency-backed dialog implementation.
- No reusable modal abstraction.
- No complex roving-tabindex grid behavior.

# Risks

- CSS column masonry has a visual order that may not perfectly match keyboard or DOM order. Navigation should follow the existing array order because that is the simplest stable product rule.
- Full-size originals may render slowly for very large images. Do not add thumbnails or processing for this feature; only revisit if manual testing shows the viewer feels unusable.
- Overlay click-to-close can accidentally close if event boundaries are sloppy. Keep overlay, image, and controls separated clearly.
- Focus return may be imperfect when the originating tile has been removed or the gallery has changed. In that case, closing cleanly is more important than adding complex focus recovery.
- Preventing background scroll should not disturb the saved gallery position after close.
- Fast transition styling should not become a decorative animation system.

# Out of Scope

- New dependencies.
- Animation libraries.
- Generic dialog or modal systems.
- Global state libraries.
- Routing changes for the viewer.
- Separate image detail pages.
- Image processing, resizing, thumbnails, or format conversion.
- Metadata panels, EXIF, titles, captions, tags, collections, or source notes.
- Zoom, pan, magnifier, minimap, or image inspection tooling.
- Slideshow, autoplay, timers, presentation mode, or thumbnail strips.
- Editing, cropping, rotation, filters, transformations, download workflows, sharing, favorites, ratings, comments, multi-select, or batch actions.
- Server, database, storage, authentication, cloud sync, or multi-user changes.

# Manual Test Plan

- Start the app and confirm the existing library page still opens directly.
- Open a saved image from the masonry grid with a pointer click.
- Open a saved image from the masonry grid with keyboard activation.
- Confirm the selected image appears in a fullscreen overlay without cropping.
- Confirm the gallery remains behind the overlay and returns to the same scroll position after close.
- Close the viewer with Escape.
- Close the viewer with the visible close button.
- Close the viewer by clicking the darkened overlay outside the image.
- Confirm clicking the image itself does not close the viewer.
- Confirm clicking previous and next controls does not close the viewer.
- Navigate to the next image with the visible next control and with `Right Arrow`.
- Navigate to the previous image with the visible previous control and with `Left Arrow`.
- Confirm previous is unavailable on the first image and next is unavailable on the last image.
- Confirm the save surface and delete tile action still behave as before after closing the viewer.
- Confirm no route changes occur when opening, navigating, or closing the viewer.
- Confirm no metadata panel, zoom controls, slideshow controls, or extra media-management actions appear.
- Confirm opening and closing feels fast and lightweight, without long or cinematic motion.
