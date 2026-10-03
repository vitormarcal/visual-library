# Feature: Related Images

Status: approved and implemented. Validation is recorded in [plan.md](plan.md).

## Problem and Goal

Gallery order and explicit filters help find images, but do not provide a direct path from one image to others with related personal meaning. Let the user follow shared tags from the fullscreen viewer without losing gallery context.

Related means sharing manually assigned tags. It does not imply visual similarity. No minimum library size is required, but the feature appears only when actual matches exist.

## Feature Boundaries

[005](../005-lightweight-tags/spec.md) defines tag identity and individual editing; [006](../006-library-search/spec.md) defines the current visible results. This feature extends the fullscreen viewer in 002 with an optional related-image section. Its no-thumbnail-strip and sparse-controls rules are narrowed only for this section.

## User Flow

1. Open an image from the gallery as today, fitted to the viewport without cropping.
2. If other images in the current gallery results share at least one tag, show a quiet `Related` action beside the normal viewer tag controls.
3. Activate it to reveal `More with these tags` below the main image and its tags, within the same overlay.
4. Browse up to six related images as a small masonry grid. Scroll the overlay to reach them; the gallery underneath stays stationary.
5. Activate a related image to replace the main image in the same viewer. Return the overlay to its top, collapse the related section, announce the new image, and focus the Related action if available or the close button otherwise.
6. Previous/next continue following the current gallery order from the newly opened image. Related images do not become a separate playlist.
7. Closing returns to the original gallery scroll position and restores focus to the tile that first opened the viewer without scrolling the gallery.

## Relatedness Rules

- Use only current visible gallery results, respecting text search and active tag filters. Do not change either when following a related image.
- Exclude the current image and images with no shared tags.
- Match shared tags using their normalized identity, without additional accent folding or semantic merging.
- Rank by number of shared tags, highest first; break ties using the current gallery order.
- Show at most six matches, each once. Show fewer if fewer qualify.
- An image with `playboy` and `mel lisboa` prioritizes images sharing both over images sharing only one.
- With no tags or no matches, omit the action and section entirely. Do not fill the space with arbitrary images or empty-state prompts.
- Use confirmed tag changes when updating matches. While editing tags, hide the Related action and section; during saving, prevent following another image. Associate save responses with the image whose request was started.
- If matches disappear, remove the section and return focus to a surviving viewer control if needed.

## Visual Direction — DESIGN.md

- Preserve the initial immersive image view. Related images appear only on explicit request and below the image, never as a side panel or an overlapping bottom tray.
- Opening the section adds scrollable content without shrinking or cropping the main image. Keep close available while scrolling.
- Use `button-tertiary` for the Related action with `typography.button-md` and neutral ink. No red discovery CTA, counts, badges, or scores.
- Use `typography.heading-md` (18px, weight 600) for `More with these tags`, in a neutral surface below the main viewing area. Keep existing tag controls near the main image.
- Separate the related block from the main content with `spacing.xl` (24px); use `spacing.md` (12px) between its heading and grid and `spacing.sm` (8px) gutters.
- Reuse `pin-card`: `colors.surface-card`, `rounded.md` (16px), zero internal padding, no shadows. Images preserve natural aspect ratio, without text rows, tag overlays, delete actions, or selection marks.
- Use `colors.canvas` or `colors.surface-soft` behind the related section, with `colors.ink` text. Keep the existing immersive overlay around the main image.
- Three columns on desktop, two on tablet/mobile, one at 480px and below. Keep the same six-item limit and use lazy loading for related imagery.
- Keep cards secondary in width to the main image; do not create another full library grid or an infinite feed.
- Use the existing system font stack and focus treatment. Ensure a minimum 44px interactive target for the Related action.

## Accessibility and Interaction

- Use real buttons for the action and each related image, with clear accessible names.
- Expose expanded state and the controlled section on the Related action; activating it again collapses the section.
- Include related controls in the viewer focus loop only while visible. Keep navigation and Escape behavior consistent with the viewer and tag editor.
- Make revealed content reachable by keyboard and touch. Do not rely on hover, animation, or horizontal dragging.
- Prevent global left/right shortcuts from interfering with related-card keyboard interaction; arrows on related cards must not replace the current image unexpectedly.
- Reset related expansion on previous/next navigation and when a different image is opened.
- Selecting a card replaces the current viewer image; it does not nest dialogs or modify tags.

## Non-goals

- AI, embeddings, visual similarity, filename matching, or automatic tags.
- External recommendations or discovery outside the saved library.
- Recommendations outside current search/filter results.
- Weighted tag systems, user preference settings, similarity scores, or analytics.
- Infinite scrolling, autoplay, browsing history, or a new back-navigation stack.
- Collections, metadata panels, persistent thumbnail strips, or changes to capture.

## Acceptance Criteria

- Shared-tag matches appear in the documented order, excluding the current image and limiting results to six.
- Untagged images and images without matches add no UI.
- Search and exact tag filters constrain recommendations and remain unchanged after selection.
- The main image retains its initial fitted presentation; expanding related images adds content below it.
- A related card opens in the same viewer, resets overlay scroll and expansion, and supports further exploration.
- Previous/next retain gallery ordering. Close retains gallery position and original focus context.
- Tag saves cannot update a different image after navigation; editing and confirmed updates keep matches coherent.
- Desktop, mobile, keyboard focus, announcements, and close behavior remain usable.
- The implementation adds no dependencies, schema changes, or new recommendation infrastructure.
