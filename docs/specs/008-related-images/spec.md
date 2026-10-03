# Feature: Related Images

Status: approved and implemented, including the UX refinement in [ux-review.md](ux-review.md). Validation is recorded in [plan.md](plan.md).

## Goal and Boundaries

Follow shared personal tags from one saved image to another without losing gallery context. Related means sharing manually assigned tags, not visual similarity.

[005](../005-lightweight-tags/spec.md) defines tags and individual editing; [006](../006-library-search/spec.md) defines visible results. This feature extends the base viewer in 002 with related-image content below the main image.

## User Flow

1. Open an image in the fullscreen viewer, fitted without cropping.
2. If matches exist, show `Explore related ↓` in the compact navigation row below the fitted image, separate from previous/next. Tags follow the viewing stage in normal flow as defined in [009](../009-viewer-image-fit/spec.md). Related content is already available below the main viewing area through normal scrolling.
3. Activate the shortcut to scroll directly to `Related images`. Keyboard activation focuses its heading; pointer activation focuses its container without a decorative focus ring.
4. Browse up to six images. A quiet `Shared tags · Current view` line explains their relationship and current search/filter boundary.
5. `Back to image ↑` scrolls to the top and restores focus to the shortcut without removing the related content.
6. Selecting a related image replaces the main image, resets overlay scroll, announces the new image, and recomputes its related content.
7. Previous/next retain current gallery ordering. Closing retains the gallery position and returns focus to the tile that originally opened the viewer without scrolling it.

## Matching Rules

- Use only current visible gallery results; preserve search and exact tag filters.
- Exclude the current image and candidates with no shared normalized tag identity.
- Rank by number of distinct shared tags, highest first; ties follow gallery order.
- Return at most six distinct images. No additional accent folding, semantic merging, or filename matching.
- `playboy` plus `mel lisboa` prioritizes candidates sharing both over candidates sharing one.
- No tags or no matches means no shortcut, section, empty-state panel, or arbitrary filler.
- Use confirmed edits when updating matches. Hide exploration while editing and prevent navigation during pending tag saves. Responses remain associated with the image whose request began.
- If related controls disappear while focused, return focus to a surviving viewer control.

## Visual Direction — DESIGN.md

- Use one continuous scrollable viewer with a quiet `colors.surface-dark` background. Main image and related content share this viewing surface; no second pale modal, sidebar, tray, or nested scrolling.
- Preserve the fitted image and its natural ratio. Keep close fixed and accessible during scrolling, with a 44px target.
- Exploration and return actions use neutral tertiary emphasis, `typography.button-md`, 16px corners, and 44px minimum height. No red discovery CTA, scores, or badges.
- Heading uses `typography.heading-md` (18px/600), `colors.on-dark`; explanatory copy uses `typography.body-sm` and `colors.on-dark-mute`.
- Align section heading and cards within a maximum 960px width, 24px desktop gutters and 16px phone gutters.
- Use `spacing.xl` (24px) section separation, `spacing.md` (12px) before cards, and `spacing.sm` (8px) card gutters.
- Reuse `pin-card`: natural image ratios, zero internal padding, `colors.surface-card` backing, 16px corners, and no shadows, metadata rows, overlays, removal controls, or selection marks.
- General masonry uses three columns on desktop, two at 768px and below, and one at 480px and below. A single match uses a single column capped at 320px; two matches use two aligned columns capped at 640px, becoming one column capped at 320px on narrow phones.
- Load related images lazily. Keep related content secondary to the main view and bounded to six items.
- Respect reduced motion with immediate scroll navigation and no opening animation. Other shortcut scrolls may use a brief native smooth transition.

## Accessibility and Interaction

- Use native buttons with accessible image names and an `aria-controls` shortcut; there is no expanded/collapsed state.
- Keep programmatically focused section/heading in the viewer's keyboard loop. Related cards and return controls must not trigger global adjacent-image shortcuts.
- Keyboard activation focuses the heading so the user can read context before choosing an image; pointer activation does not highlight a candidate as though it were selected.
- Escape and tag-editor behavior retain their existing meaning. No hover-only interaction or horizontal dragging requirement.
- Selecting related cards reuses the viewer rather than creating nested dialogs, routes, or a playlist.

## Non-goals

AI, embeddings, visual similarity, external recommendations, results outside current filters, weighted tag systems, scores, statistics, preference settings, infinite feeds, autoplay, history stacks, collections, metadata panels, capture changes, or new dependencies.

## Acceptance Criteria

- Correct ranking, exclusions, distinct results, current-view restrictions, and six-image limit.
- Normal scroll and Explore related reach the same content without toggling visibility.
- Keyboard and pointer navigation make the destination visible with appropriate focus.
- Back to image returns without collapsing content; card selection opens the new image at the top.
- One, two, and six matches have balanced widths; phone layout does not overflow horizontally.
- Main images are not cropped, controls remain legible, and close stays reachable.
- Navigation, pending tag saves, no-match states, and returning to the gallery retain their documented context.
