# Feature: Lightweight Tags

## Problem

The library is intentionally optimized for visual browsing, but rediscovering older images becomes harder as the collection grows. Pure masonry browsing works well for recent saves and visual scanning, but it depends heavily on memory of where an image is in the grid.

The product needs a lightweight way to attach personal visual-memory cues to images and use those cues to temporarily narrow the gallery, without turning the library into a metadata manager, taxonomy system, or search-first interface.

## Goal

Let a single local user add short, optional, freeform tags to saved images from the fullscreen viewer, then use those tags as lightweight browsing filters in the existing masonry gallery.

Tags should feel like quick mental cues for theme, mood, and visual atmosphere:

- cozy
- brutalist
- warm
- dark
- minimal
- blue
- cinematic
- retro
- earthy
- monochrome

Light contextual tags are acceptable when they support rediscovery:

- wallpaper
- ui-reference
- room ideas
- typography

The feature should support rediscovery while preserving capture-first behavior, calm browsing, visual density, and the masonry gallery as the primary product surface.

## User Flow

1. User saves images through the existing capture flow without being asked for tags.
2. User browses the masonry gallery as usual.
3. User opens an image in the fullscreen viewer.
4. The viewer shows existing tags as quiet chips, or a small `+ Add tag` affordance if the image has no tags.
5. User uses the small tag affordance to add tags inline.
6. User types a natural tag or short phrase and presses Enter.
7. The tag appears immediately as a quiet chip near the image controls.
8. If the image already has tags, a small `+` affordance opens the same lightweight inline tag editing.
9. In edit mode, tags can be added or removed inline.
10. Outside edit mode, clicking a tag chip closes the viewer and returns to the masonry gallery with that tag active as a filter.
11. The gallery narrows to matching images.
12. Active tag filters appear in a slim contextual bar above the masonry grid.
13. User may add a small number of additional active tag filters by selecting tags.
14. User can remove individual active filters or clear all filters to return to the normal gallery.
15. Once at least one tag exists in the library, a small `Tags` control appears near the gallery area.
16. The `Tags` control opens a small lightweight popover or sheet with a mix of recent and commonly used tags.
17. Selecting a tag from that control immediately filters the current masonry gallery.

## Scope

- Optional user-created tags on saved images.
- Tags created and edited primarily inside the fullscreen viewer.
- Tags shown as quiet chips inside the fullscreen viewer.
- A small persistent `+ Add tag` affordance for untagged images in the viewer.
- A small `+` affordance beside existing viewer tags for inline editing.
- Inline tag entry using free typing and Enter to confirm.
- Natural-language tags and short phrases, including spaces.
- Lightweight tag removal only while inline edit mode is active.
- Clickable viewer tag chips that close the viewer and filter the gallery.
- Temporary gallery filtering by active tags.
- A slim active-filter bar above the masonry grid only when filters are active.
- Support for a very small number of simultaneous active tag filters.
- Active tags narrow the current gallery view using a simple implicit narrowing behavior.
- Current filtered results update immediately when tags change.
- A small gallery-adjacent `Tags` control after at least one tag exists.
- A small `Tags` popover or sheet showing a lightweight mix of recent and commonly used tags.
- Selecting a tag from the `Tags` control filters the current gallery immediately.
- Lightweight tag suggestions while typing are acceptable if they stay secondary to free typing.
- Basic protective limits:
  - up to 8 tags per image;
  - approximately 40-48 characters per tag.
- Very small inline feedback near the tag input when limits are reached.
- Lightweight normalization:
  - trim leading and trailing whitespace;
  - collapse accidental repeated spaces;
  - compare tags case-insensitively.

## Non-goals

- Mandatory tagging during save.
- Tag fields, forms, or metadata prompts in the capture flow.
- Tags displayed persistently in the masonry grid.
- Tag overlays on masonry tiles.
- Hover or focus tag visibility in the masonry grid for v1.
- Permanent tag rows under image tiles.
- Metadata-heavy cards.
- Dedicated tag pages or tag routes.
- Dedicated tag management screens.
- Tag descriptions.
- Tag colors.
- Nested tags.
- Tag hierarchies.
- Parent/child tag relationships.
- AI tagging.
- Automatic tagging.
- Suggested semantic categories.
- Alias systems.
- Semantic merging.
- Forced kebab-case or hashtag syntax.
- Smart collections.
- Saved searches.
- Query syntax.
- AND/OR configuration UI.
- Advanced filter panels.
- General text search for tags in v1.
- Persistent tag clouds.
- Large tag browsers.
- Alphabetical management views.
- Visible usage statistics.
- Bulk tag editing.
- Multi-select tagging workflows.
- Advanced metadata management.
- Dedicated metadata side panels, drawers, or inspectors.
- Enterprise-style organization.
- Turning tags and collections into one abstraction.

## UX Rules

- The gallery remains image-first and masonry-first.
- The save flow must remain fast, interruption-free, and free of required metadata.
- Tagging is a lightweight reflective action, not part of core capture.
- The fullscreen viewer is the primary place for adding and editing tags.
- Viewer tags must stay visually quiet and secondary to the image.
- Tags should feel like personal visual associations, not formal categories.
- Tags should support theme, mood, atmosphere, and light context.
- The masonry grid must not show tags in v1.
- Filtering should feel like a temporary lens over the current gallery, not navigation to a separate place.
- Active filters should be visible only when active.
- Active filters should live in a slim contextual bar above the masonry grid.
- Clearing filters should immediately restore the normal gallery.
- Clicking a tag in the viewer means "show me more like this."
- Clicking a viewer tag should close the viewer and return to the filtered gallery.
- Filtering belongs to gallery exploration, not inside the open viewer.
- Active filtered results should always reflect current live tag state.
- The `Tags` control should remain hidden until at least one tag exists.
- The `Tags` control should feel like a rediscovery shortcut, not a taxonomy browser.
- The `Tags` control should lean slightly toward recent usage while also surfacing commonly used tags.
- Tag suggestions during entry must be small and secondary to free typing.
- Users should never be forced to reuse an existing tag.
- Removing tags should require entering inline edit mode so normal chips remain calm and readable.
- Persistent remove controls must not appear on every tag chip in normal viewer state.
- Limit feedback should be clear but quiet, using small inline copy such as:
  - `Too many tags`
  - `Tag is too long`
- Do not use modal warnings, large validation states, onboarding copy, or empty metadata panels.
- The UI follows `DESIGN.md`: image-forward composition, minimal warm neutral chrome, rounded quiet chips, compact controls, and restrained red usage.

## Tag Behavior Rules

- Tags are optional.
- Tags may contain spaces.
- Pressing Enter confirms the full typed tag.
- Tags should preserve natural human-readable wording.
- Leading and trailing whitespace is ignored.
- Accidental repeated spaces are collapsed.
- Case variants should behave as the same tag:
  - `Dark`
  - `dark`
  - `DARK`
- Lightweight punctuation differences do not need aggressive merging in v1:
  - `room ideas`
  - `room-ideas`
- The app should not automatically convert spaces to hyphens.
- The app should not require hashtags, commas, or special grammar.
- If the user reaches the per-image tag limit, show a small inline message near the input.
- If the typed tag is too long, show a small inline message near the input.
- All tags on an image should be visible in the fullscreen viewer, wrapping naturally if needed.

## Filtering Rules

- Selecting a tag narrows the current masonry gallery to matching images.
- Selecting additional tags may narrow the current gallery further.
- The first version may support a very small number of simultaneous active tags.
- Filter logic should stay implicit and simple.
- The UI must not expose query logic controls.
- Active filters appear as quiet chips above the gallery.
- Each active filter can be removed from the active-filter bar.
- A clear action removes all active filters.
- Filtering does not open a separate page.
- Filtering does not create a saved view.
- Filtering does not change the capture surface.
- Filtering does not add tag labels to masonry tiles.
- If an image no longer matches active filters after tag editing, it should disappear from the filtered gallery when the viewer closes.
- If an image gains tags that match active filters, it should appear in the filtered gallery when the gallery state updates.

## Acceptance Criteria

- A user can save images without entering tags.
- A user can open a saved image in the fullscreen viewer and see its tags as quiet chips.
- An untagged image in the viewer shows a small persistent `+ Add tag` affordance.
- A tagged image in the viewer shows existing quiet chips plus a small `+` affordance.
- A user can add a tag from the fullscreen viewer by typing a tag and pressing Enter.
- A user can add tags containing spaces.
- A newly added tag appears immediately in the viewer.
- A user can remove tags only from the lightweight inline edit state.
- Normal viewer tag chips do not show persistent remove controls.
- Clicking a viewer tag closes the viewer and filters the masonry gallery by that tag.
- The gallery narrows without navigating to a tag page.
- Active tag filters appear in a slim contextual bar above the masonry grid.
- The active-filter bar is hidden when no filters are active.
- A user can remove one active tag filter.
- A user can clear all active tag filters.
- A user can apply a very small number of simultaneous active tag filters.
- Active filters update immediately based on current tag state.
- The masonry grid does not show tags on tiles in v1.
- The save surface does not show tag fields or tag prompts.
- The `Tags` control is hidden until at least one tag exists in the library.
- Once tags exist, a small `Tags` control appears near the gallery area.
- The `Tags` control opens a small lightweight popover or sheet with recent and commonly used tags.
- Selecting a tag from the `Tags` control filters the current gallery immediately.
- Tag entry applies lightweight normalization for whitespace and case-insensitive matching.
- The app does not force kebab-case, hashtags, aliases, semantic merging, or taxonomy rules.
- A user cannot add more than the v1 per-image tag limit.
- A user receives small inline feedback when the per-image tag limit is reached.
- A user receives small inline feedback when a tag is too long.
- The feature does not introduce nested tags, tag hierarchies, AI tagging, automatic tagging, tag colors, tag descriptions, bulk editing, smart collections, advanced search, or metadata management screens.
- The UI remains visually calm, capture-first, masonry-first, and consistent with `DESIGN.md`.
