# Feature: Frictionless Image Save

## Problem

Users need a fast way to save visual references from the internet without turning the action into a form or file-management task.

## Goal

Let a single user paste, drop, or upload an image and immediately see the saved image appear in their personal visual library after successful save completion.

## User Flow

1. User opens the library view.
2. User uses the always-visible save surface to paste, drag-and-drop, or upload an image.
3. After successful save completion, the image appears in the visual grid immediately.
4. A subtle transient success indication may appear without interrupting browsing.
5. If saving fails, lightweight non-blocking feedback explains the failure while keeping the user in the gallery.
6. User continues browsing the gallery.
7. If the image was saved by mistake, user can remove it from the image tile hover/focus action.

## Scope

- One primary library view.
- Lightweight always-visible save surface integrated into the library view.
- Save by direct image paste, drag-and-drop, or local upload.
- Masonry-style visual grid of saved images.
- Image appears immediately after successful save completion.
- Subtle delete/remove action on image hover/focus.
- Single-user local library assumptions.

## Non-goals

- Required titles, descriptions, source notes, tags, or collections.
- Remote image URL saving or URL ingestion.
- Authentication.
- AI tagging or image analysis.
- Cloud sync.
- Multi-user support, social features, or sharing features.
- Edit, rename, favorite, move, multi-select, context menus, or metadata panels.
- Upload completion screens, success pages, modal confirmations, or redirects.

## UX Rules

- The gallery remains the primary focus.
- The save surface must be obvious but visually lightweight.
- Saving must feel like capturing a visual thought, not filling a form.
- The user stays in the visual grid after saving.
- Failure feedback must be lightweight, transient, and non-blocking.
- Failed saves must not redirect the user, clear the gallery, or open a blocking modal.
- Management UI must stay secondary to browsing.
- Images are the interface: use dense masonry layout, minimal chrome, rounded pin cards, and quiet warm neutral surfaces from `DESIGN.md`.
- Primary actions use the red CTA treatment from `DESIGN.md`; secondary chrome remains monochrome and subdued.

## Acceptance Criteria

- A user can save an image by paste, drag-and-drop, or upload without entering metadata.
- A saved image appears in the gallery immediately after successful save completion.
- If saving fails, the user receives lightweight non-blocking feedback and remains in the gallery.
- The save flow does not open a blocking confirmation, success page, or separate workflow.
- The visual grid remains visible before, during, and after saving.
- Each saved image exposes a subtle delete/remove action only on hover or focus.
- Removing an image takes it out of the gallery.
- The feature assumes one local user and provides no multi-user, sharing, or collaboration behavior.
- The UI follows the visual direction in `DESIGN.md`.
