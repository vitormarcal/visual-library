# Related Images — UX/UI Review

Status: approved and implemented. The current spec and plan describe the continuous viewer refinement. This review records the reasoning behind the change.

## Evidence and Limits

Review based on DESIGN.md, CONSTITUTION.md, current viewer code, the user's report that Related appeared to do nothing, and official competitor documentation. The automatic reveal fix addresses that immediate problem. Competitor documentation supports interaction patterns, not a pixel-level audit of their current authenticated interfaces.

- Pinterest documents scrolling below an opened Pin to discover related ideas: https://help.pinterest.com/en/article/discover-ideas-on-pinterest
- Are.na documents traversing human-created connections and previewing destinations before choosing a path: https://help.are.na/docs/getting-started/connections
- Eagle emphasizes uncropped imagery, instant previews, and simple adjacent-image navigation: https://eagle.cool/home

Recommendation is a design judgment for this product, not a claim of a universally best or user-tested interface.

## Current Friction

- Related mixes a navigation action with tag chips that filter the gallery.
- A viewport-sized main area puts all destinations below the initial screen.
- Conditional expansion adds a hidden state; the initial behavior offered no visible evidence of the result.
- The pale rounded container over the dark overlay feels like a second modal rather than a continuation of viewing.
- More with these tags is less direct than Related images and does not identify which contextual boundaries apply.
- One or two matches inherit a three-column grid, leaving sparse space.
- A single-column phone grid can turn six portrait scans into a long browsing session.
- Pointer activation moves keyboard focus to the first card, showing its focus outline even when the user only wanted to look. Focus should follow input modality.
- CSS column order makes ranking flow down columns rather than strictly across a row. That is an acceptable existing masonry tradeoff, but should not be presented as a numbered recommendation list.

## Recommended Direction

Make related images a natural continuation of the same viewer, with one scroll container and a clear optional shortcut. Preserve the initial main-image fit, gallery context, exact relatedness rules, and six-item limit.

### Main Viewing Area

- Keep the fitted main image and sparse close/previous/next controls.
- Separate exploration from tagging: place an `Explore related` action with a downward chevron on its own compact line below the tag controls, within the space reserved for viewer controls.
- Show it only when matches exist. Use neutral secondary emphasis, a 44px target, and restrained typography.
- Related content exists below the viewing area whenever matches exist; normal scrolling reaches it without first activating a toggle.
- Activating Explore related scrolls to its heading. Use a brief scroll transition only when reduced motion is not requested. Keyboard activation moves focus to the section heading; pointer activation keeps a calm visual state without forcing a card focus ring.

### Related Section

- Replace the large pale container with a flat section on a continuous `colors.surface-dark` viewing background. Remove the outer card padding and radius; keep image-card radii.
- Heading: `Related images`, using heading-md (18px/600) and on-dark text.
- One quiet supporting line: `Shared tags · Current view`, using body-sm and on-dark-mute. This explains why candidates qualify and that current search/filters constrain them, without claiming visual similarity.
- A tertiary `Back to image` action with an upward chevron scrolls to the image. It does not remove content or change a toggle state.
- Use a max-width around 960px with 24px desktop gutters and 16px phone gutters. Align heading and image grid.
- Separate sections with spacing.xl (24px), heading from grid with spacing.md (12px), and image cards with spacing.sm (8px).
- Reuse pin-card geometry: full-bleed natural ratios, 16px corners, surface-card backing, no shadows, scores, overlays, or metadata rows.
- Use up to three columns on desktop and two on tablet. Reduce columns for one or two results and cap sparse sections' width so lone images do not become huge.
- Start with the documented single-column layout at 480px and below. Evaluate a two-column phone variant with actual scans and touch targets before departing from DESIGN.md; do not assume more density is always better.

### Following a Connection

- Selecting a candidate replaces the main image, returns overlay scroll to the top, and recomputes the related section below it without a nested dialog or reopening step.
- Keep search, exact filters, gallery order, and original return-focus tile unchanged.
- Previous/next remain gallery navigation. Avoid treating related cards as a playlist.
- Keep the close control fixed and accessible throughout scrolling; use neutral circular controls with a 44px effective target.
- During tag editing, keep related content out of the interaction flow; after confirmed changes, restore only valid matches. Preserve the existing pending-save protection.
- No matches means no section, shortcut, empty-state panel, or arbitrary filler.

## Acceptance Checks for a Refinement

- A first-time viewer can identify that exploration continues below without trial-and-error.
- Both normal scrolling and Explore related reach the same visible content.
- The selected image's fit and aspect ratio remain intact on desktop and phone, including long tag phrases and eight tags.
- Related content feels like part of viewing rather than a separate dialog; controls remain legible over the dark surface.
- One, two, and six matches produce balanced widths and usable targets.
- Keyboard users reach an announced section heading; pointer users do not receive unnecessary focus-ring emphasis.
- Back to image, following a candidate, Escape, previous/next, and closing preserve their expected context.
- Review with portrait scans, landscapes, mixed image sizes, reduced motion, and real phone interaction. Competitor patterns alone do not establish usability.

## Scope

This refinement changes presentation and navigation affordances. Keep ranking, candidate boundaries, optional tags, storage, and APIs unchanged. No AI, external recommendations, new settings, history stacks, extra filters, sidebars, or new dependencies.
