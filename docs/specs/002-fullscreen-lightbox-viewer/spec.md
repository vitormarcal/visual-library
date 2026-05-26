# Feature: Fullscreen Lightbox Viewer

## Problem

The gallery is optimized for fast visual scanning, but a user sometimes needs to pause on one saved image without leaving the browsing flow. Opening an image should feel like leaning into the masonry grid, not entering a separate media-management screen.

## Goal

Let a single local user open a saved image from the masonry gallery into an immersive, lightweight fullscreen viewer, move to nearby images, then return to the same gallery context without losing browsing momentum.

## User Flow

1. User browses the saved image masonry grid.
2. User opens an image directly from its tile.
3. The current image appears in a fullscreen overlay above the gallery.
4. The gallery remains the underlying context, visually de-emphasized but not replaced by a separate page.
5. User can move to the previous or next saved image from the current gallery order.
6. User closes the viewer and returns to the same masonry position.
7. User continues browsing, saving, or removing images from the gallery.

## Scope

- Open a saved image from the existing masonry grid.
- Fullscreen overlay viewer for one selected image.
- Previous and next navigation through the current `images` array order.
- Lightweight close behavior.
- Keyboard support for close and adjacent-image navigation.
- Preserve the current gallery scroll position and visual browsing context.
- Use the same local image records and image routes already used by the grid.
- Single-user local library assumptions.

## Non-goals

- Image editing, cropping, rotation, filters, or transformations.
- Metadata panels, titles, descriptions, tags, collections, source notes, or EXIF views.
- Zoom systems, pan systems, minimaps, magnifiers, or image inspection tooling.
- Slideshows, autoplay, timers, presentation mode, or playlist behavior.
- Comments, sharing, collaboration, reactions, ratings, favorites, or multi-select actions.
- Separate image detail pages or route-first media views.
- Remote URL ingestion, cloud sync, accounts, permissions, or multi-user support.
- Download/export flows beyond what the browser naturally allows.
- New storage models, thumbnail pipelines, or media-processing infrastructure.

## UX Rules

- The masonry grid remains the primary product context.
- Opening the viewer must feel like a direct extension of selecting a grid image.
- Closing the viewer must return the user to the same gallery position, not the top of the page.
- The viewer should be immersive but visually quiet: image first, minimal chrome second.
- Controls should appear only where they help the current viewing action.
- Chrome must not compete with the image. Use subdued neutral controls and avoid dense toolbars.
- Navigation should follow the same order the user sees in the current gallery.
- Edge navigation must be simple: previous is unavailable on the first image, next is unavailable on the last image.
- The save surface and gallery should not be duplicated inside the viewer.
- Delete remains a grid tile action, not a primary viewer action.
- The feature must not make the product feel like a photo backup app, file manager, or digital asset manager.
- The UI follows `DESIGN.md`: image-forward composition, minimal warm neutral chrome, rounded controls, and restrained red usage.

## Interaction Behavior

- Clicking or pressing Enter/Space on an image tile opens that image in the viewer.
- Escape closes the viewer.
- A visible close control closes the viewer.
- Clicking the darkened overlay outside the image closes the viewer.
- Clicking the image itself does not close the viewer.
- Clicking previous, next, or close controls does not trigger overlay-close behavior.
- Left Arrow moves to the previous image when available.
- Right Arrow moves to the next image when available.
- Visible previous and next controls move through adjacent images when available.
- The first implementation does not include swipe gestures.
- Touch interaction uses the same explicit controls as pointer interaction.
- Opening the viewer should not trigger delete behavior.
- Viewer controls must be reachable by keyboard and have clear accessible names.
- Focus should move into the viewer while open and return to the originating image tile when closed when practical.

## Visual Direction

- Use a fullscreen overlay rather than a separate page transition.
- The selected image should be centered and sized to fit within the viewport without cropping.
- The background should reduce visual noise from the gallery while preserving the feeling that the grid is still underneath.
- Controls should be sparse: close, previous, and next.
- Controls should use familiar icon-like button shapes or concise labels only where necessary.
- The current image should remain the largest and clearest element on screen.
- Opening and closing should feel visually fast and lightweight.
- Avoid heavy cinematic animations or long transitions.
- Avoid side panels, bottom trays, thumbnail strips, metadata blocks, captions, and persistent command bars.

## Acceptance Criteria

- A user can open any saved image from the masonry grid into a fullscreen viewer.
- The fullscreen viewer displays the selected image without cropping it.
- The user can close the viewer with Escape and with a visible close control.
- The user can close the viewer by clicking the darkened overlay outside the image.
- Clicking the image or navigation controls does not close the viewer.
- The user returns to the same gallery browsing position after closing the viewer.
- The user can navigate to the previous and next saved image from the current gallery order.
- Previous and next navigation is unavailable at the start and end of the gallery order.
- Keyboard navigation supports Escape, Left Arrow, and Right Arrow.
- The viewer does not expose editing, metadata, slideshow, zoom, sharing, or advanced media-management tools.
- The viewer does not introduce a separate image-detail page or replace the masonry-first browsing model.
- The feature assumes one local user and uses the existing local image records.
- The UI follows the visual direction in `DESIGN.md`.
