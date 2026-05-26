# Feature: Lightweight Duplicate Awareness

## Problem

The current save flow intentionally makes image capture fast and low-friction, but that also makes it easy to accidentally save the same image more than once. Duplicate saves add visual clutter to the library and make browsing feel less curated.

The product needs a small amount of duplicate awareness without becoming a deduplication tool, media manager, or image analysis system.

## Goal

Prevent future accidental duplicate saves when the duplicate match is deterministic and high-confidence, while preserving the existing lightweight capture flow.

A duplicate attempt should behave like a quiet no-op:

1. The image is not saved again.
2. No second gallery item is created.
3. The gallery remains visually unchanged.
4. The user sees lightweight neutral feedback: "Already saved."

## User Flow

1. User saves an image through the existing save surface.
2. The app briefly uses the same lightweight saving state already used by normal saves.
3. If the image is not already saved, the normal save flow completes and the image appears in the gallery.
4. If the image is already saved by strict deterministic rules, the app prevents the duplicate save.
5. The app shows "Already saved." in the existing notice area near the save surface.
6. The gallery remains unchanged and the user continues browsing or saving.

## Scope

- Prevent future duplicate saves only.
- Apply duplicate prevention consistently across all existing save paths:
  - local upload;
  - drag/drop;
  - clipboard image paste;
  - direct image URL paste.
- Treat identical exact image bytes as duplicates across the whole library, regardless of save source.
- Treat a direct image URL save as a duplicate only when the resolved image bytes are also identical to an existing saved image.
- Allow the same source URL to create a new saved image if it later resolves to different image bytes.
- Show duplicate feedback in the existing lightweight notice area near the save surface.
- Use neutral feedback copy: "Already saved."
- Keep duplicate attempts as no-op outcomes that do not mutate existing image records.
- Avoid unnecessary repeated recomputation for already-saved images where practical.

## Non-goals

- Perceptual hashing.
- AI similarity.
- Image analysis.
- Visual similarity detection.
- Resized or recompressed equivalence.
- Fuzzy duplicate detection.
- Historical duplicate scanning.
- Duplicate cleanup, merging, or deletion workflows.
- Duplicate review screens.
- Conflict resolution UI.
- Confirmation dialogs.
- Auto-opening, scrolling to, or highlighting the existing saved image.
- Reordering or refreshing an existing image after a duplicate attempt.
- Updating timestamps or recency purely because of a duplicate attempt.
- Source-first duplicate behavior where a URL alone permanently defines image identity.
- New notification systems, persistent warnings, banners, or modal states.

## Duplicate Rules

- Same exact image bytes already exist in the library:
  - duplicate;
  - prevent the save;
  - show "Already saved.";
  - leave the gallery unchanged.

- Same `source_url` and same exact image bytes:
  - duplicate;
  - prevent the save;
  - show "Already saved.";
  - leave the gallery unchanged.

- Same `source_url` but different exact image bytes:
  - not a duplicate;
  - save as a new image.

- Different sources resolving to identical exact image bytes:
  - duplicate;
  - prevent the save;
  - show "Already saved.";
  - leave the gallery unchanged.

## UX Rules

- Duplicate prevention must feel like part of the normal save flow, not a separate duplicate-management feature.
- The existing unified save surface remains the only capture surface.
- Duplicate attempts may briefly show the same saving state used by normal saves.
- Do not introduce duplicate-specific stages such as "checking", "verifying", or progress messaging.
- Duplicate feedback is neutral, not an error.
- Feedback should feel closer to success or neutral notice styling than warning or error styling.
- The message should be concise and calm: "Already saved."
- The gallery must remain visually stable after a duplicate attempt.
- The app must not move the existing image, open it, highlight it, scroll to it, or otherwise turn duplicate prevention into navigation.
- Existing duplicates remain untouched.
- The behavior should be deterministic and understandable: exact bytes only, no similarity guesses.
- Duplicate checks should reuse stored exact identity for already-saved images where practical, without adding user-visible complexity.

## Acceptance Criteria

- Saving a new image still follows the existing save behavior and inserts the saved image into the gallery.
- Saving an image whose exact bytes already exist prevents creation of a second image record.
- A duplicate attempt does not insert another gallery tile.
- A duplicate attempt leaves the gallery order and visible state unchanged.
- A duplicate attempt shows "Already saved." in the existing lightweight notice area.
- Duplicate feedback is not styled or framed as an error.
- Duplicate prevention applies to local upload, drag/drop, clipboard image paste, and direct image URL paste.
- A local image and a URL image with identical exact bytes are treated as duplicates.
- Two different URLs resolving to identical exact bytes are treated as duplicates.
- The same URL resolving to different exact bytes is saved as a new image.
- Duplicate detection avoids unnecessary repeated recomputation for already-saved images where practical.
- Existing duplicates are not scanned, merged, removed, highlighted, or otherwise managed.
- The feature does not introduce perceptual hashing, AI similarity, image analysis, fuzzy matching, cleanup workflows, confirmation dialogs, or duplicate review UI.
- The UI follows `DESIGN.md`: image-forward composition, minimal warm neutral chrome, lightweight feedback, and restrained interaction weight.
