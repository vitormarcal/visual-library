# Feature: Connected Browsing

Status: approved for implementation by the user on 2026-10-04 and implemented. Validation is recorded in [plan.md](plan.md).

## Problem

Related images currently stay inside the gallery's search and filters. A search for `manara` can therefore hide a useful connection through `playboy` to `mel lisboa`. Following a related image also replaces the current image without a way to retrace that choice.

This is a user-selected product hypothesis, not a claim of validated usage friction. Evaluate whether it improves real rediscovery after implementation.

## Goal

Follow personal tag connections across the saved library and retrace choices while preserving the gallery where exploration began. Extend the existing viewer rather than introduce a separate browsing mode or screen.

This follows CONSTITUTION.md: optional personal memory cues, image-first discovery, minimal controls, and low-friction browsing.

## User Flow

1. Open an image from the gallery, with or without a search or filters.
2. Scroll or use the existing `Explore related ↓` shortcut. The section reads `Shared tags · Entire library`.
3. Browse up to six related images from the full saved library. Each card has one quiet connection caption, for example `Shared tag: playboy`.
4. Choose a card. The same viewer opens that image at the top, even if it is outside the original results. Connections are recalculated from this image.
5. Follow another connection, such as an image sharing `mel lisboa`.
6. Use `Back` to retrace the last image transition and restore the place where that choice was made. Continue going back until the excursion's starting point.
7. Close the viewer to return to the original gallery search, filters, and scroll position.

## Scope and Matching

- Use confirmed, manually assigned tag identities across the full saved library.
- Preserve the current ranking: most distinct shared tags first; ties follow newest-first library order; at most six distinct images, excluding the current image.
- No accent folding or semantic matching for tag identity. Existing tag normalization remains authoritative.
- Show the first shared display tag in the current image's tag order. When more are shared, use `Shared tag: playboy (+1)` rather than list every tag.
- The caption explains a connection, not a score. It is plain text inside the card button, below the image, with no independent filter action.
- Images with no tags or no matches have no related section or filler. An existing Back action remains available.
- Do not suppress previously visited candidates or reorder results based on history. Intentional revisits are allowed.

## Navigation and Return

- Search and filters constrain the gallery and its previous/next arrows. They no longer constrain related candidates.
- When the current image belongs to visible gallery results, previous/next and Left/Right retain their existing gallery order.
- When the current image is outside those results, both adjacent arrows are unavailable. Do not silently switch them to library order or give them the meaning of Back.
- The first related-card choice starts an excursion. Earlier ordinary arrow browsing does not create a Back history.
- During an excursion, subsequent related choices and successful previous/next transitions can be retraced. Back pops the most recent transition and never creates another entry.
- Back is separate from `Back to image ↑`, which only scrolls the current image to the top. Use `Back to main image ↑` for the latter to clarify the distinction.
- Closing discards the excursion. Reopening begins with no Back history. No forward history or persistence across reloads.
- Escape retains its existing editor/close behavior. The browser's Back button remains unchanged.
- Opening the same image again does not create a history entry.

## Gallery Context and Tag Editing

- Related navigation and ordinary close do not modify search text or selected filters.
- Tag edits persist normally and can legitimately change gallery results. Keep the viewer open even when its image stops matching the gallery.
- Preserve selected filters during viewer tag editing, including a filter that now has no matches. Users can clear it in the gallery; do not silently broaden the original search.
- Clicking a normal viewer tag remains an explicit request to add a gallery filter and close on success, with the existing three-filter limit. This intentionally changes the gallery context and ends the excursion.
- No automatic clearing of filters when following a connection.
- If the original tile is still visible on close, return focus there without scrolling. Otherwise focus the search field without scrolling. Content edits may change layout; exact pixel restoration is guaranteed only when gallery content is unchanged.
- If a historical image is no longer present in loaded library state, skip it when going back. If the current image disappears, return to the last surviving history entry or close with quiet feedback and a valid gallery focus target.

## Visual and Accessibility Rules

- Preserve the dark continuous viewer, viewport-fitted main image, below-stage tags, natural image ratios, and the single scroll container from 009.
- Place Back in the already-reserved top control area, opposite close. Keep both accessible during scrolling, with at least 44px touch targets and safe-area spacing. Do not add a control row that reduces image space.
- Back appears only when there is a surviving history entry. Use quiet neutral tertiary styling and an accessible name such as `Back to previous viewed image`.
- Preserve the existing related masonry, sparse one/two-image layouts, six-card limit, 16px corners, and 8px gutters.
- Connection captions use DESIGN.md body-sm (14px), on-dark-mute, wrapping long tags within the card width. No overlay badges, colored tag chips, or metadata panels.
- Give each related button an accessible name including its image name and connection. Captions are secondary to imagery.
- On a new choice, reset viewer scroll and announce the newly opened image. On Back, restore prior viewer scroll and focus to the triggering card/control when it still exists; otherwise choose a surviving control without scrolling away from the restored position.
- Respect reduced motion. Preserve the focus loop and the existing protections against arrow navigation inside editing/related content.
- Block related choices, Back, and adjacent navigation while tag saving is pending. Closing retains existing behavior; responses must remain associated with their original image.

## Explicit Changes to Existing Boundaries

This feature supersedes 008's current-filter restriction, prohibition of history stacks, and prohibition of card metadata only for a one-line connection caption. It supersedes 005's automatic viewer close on leaving results and filter pruning during viewer edits. Gallery deletion pruning remains unchanged.

Search matching, tag identity and limits, bulk selection scope, and image fitting retain their existing rules. The linked existing specs now reference these changes.

[Visual tag exploration](../012-visual-tag-exploration/spec.md) also supplies subject galleries as viewer origins. Related candidates still use the full library; ordinary close retains the subject and its refinements. Explicit viewer tag filtering refines that gallery, counting its protected base tag toward the existing three-tag limit.

## Non-goals

AI, visual similarity, embeddings, random discovery, infinite feeds, autoplay, tag taxonomies, collections, visited badges, breadcrumbs, visible history lists, browser-history integration, forward navigation, settings, zoom, swipe gestures, new routes, API endpoints, database changes, or dependencies.

## Acceptance Criteria

- With a `manara` gallery filter, follow a `playboy` connection to an image outside the results and then a `mel lisboa` connection without clearing the filter or closing the viewer.
- Rank at most six related images using the full loaded library and exact distinct shared tags. Connection captions correspond to real shared tags.
- Back retraces A → B → C to B and A with the previous scroll and valid focus restored; choosing A → B → A also behaves predictably.
- Starting an excursion after ordinary gallery navigation returns first to the actual starting image, not the originally opened tile. Closing still returns to that original tile when available.
- Previous/next remain restricted to visible results; both are unavailable outside those results. During an excursion, arrow transitions are retraceable.
- Closing clears excursion history and preserves gallery search, filters, scroll, and valid focus. An explicit viewer-tag filter ends the excursion and follows existing filtering limits.
- Tag edits refresh connections without forcing the viewer closed or pruning the original filters. Missing historical images and disappearing focus targets have safe fallbacks.
- Pending tag saves cannot be bypassed by new navigation controls. Late responses never affect a different image or reopened viewer session.
- Validate keyboard, pointer, reduced motion, phone portrait/landscape, tablet, and desktop. Long tags and captions cause no horizontal overflow, close/Back overlap, or reduction in the fitted image area.
- Evaluate actual rediscovery and caption usefulness with the user's collection before expanding the feature.
