# Feature: Multiple Image Save

Status: approved and implemented on 2026-10-04. Validation is recorded in [plan.md](plan.md).

Reviewed against DESIGN.md before implementation in [ux-review.md](ux-review.md). Visual rules below define the implemented scope.

## Problem

The local file picker accepts one image at a time. Saving several references from the computer requires repeatedly opening it. The drop surface also takes only the first image from a group, leaving the rest unsaved without an explanation.

## Goal

Select several local images once and save them through the existing capture surface, with immediate gallery updates and clear feedback. Preserve CONSTITUTION.md's lightweight, image-first capture without required metadata or an import screen.

## User Flow

1. Activate `Choose images` and select one or several files from the computer, or drop several local files on the existing surface.
2. Saving starts immediately. No preview, confirmation, or metadata form.
3. The capture surface shows compact progress such as `Saving 3 of 12…`. This means processing the third file, not that three have already succeeded.
4. Each newly saved image appears in the gallery as its save completes. Existing search and filters remain active; a saved image may not match them.
5. A duplicate is counted as already saved. An invalid or failed file does not prevent the remaining files from being processed.
6. At completion, show a short summary such as `9 saved · 2 already saved · 1 failed`.
7. If any files failed, offer a collapsed inline disclosure such as `View 1 failure`, listing filenames and short reasons when opened. Offer `Retry failed` only when there are potentially recoverable failures; invalid or oversized files require choosing a supported file instead. Retrying includes only recoverable failed files, never successful or duplicate entries.
8. Continue browsing or start another selection. Selecting only one image remains as simple as today.

## Scope

- Multiple local files selected through the browser's native file picker.
- Multiple local files dropped on the existing capture surface, as a consistent extension of the same action.
- Progress, incremental gallery updates, duplicate counts, and recoverable partial failure.
- One active save operation at a time. While it is active, disable the picker and ignore additional drop/paste save attempts with brief contextual feedback. Do not silently start overlapping operations or append more files to the active group.
- Existing single-image clipboard paste and single direct-image URL paste retain their behavior and share the same busy guard.
- Preserve JPEG, PNG, WebP, GIF, and AVIF support and the existing 15 MB limit per file. Do not impose a new total-size or file-count limit without demonstrated need.

## UX Rules

- Keep the existing save surface and its quiet warm neutral design from DESIGN.md. `Choose images` remains the primary red action; failure retry uses neutral secondary styling.
- Keep progress inside this surface, with a stable compact layout and accessible status announcements. No notification for each individual success.
- Gallery browsing, search, and the viewer remain usable during saving. Do not jump to the top or automatically open a saved image.
- Process each file once per attempt. Drag transfer representations of the same file must not cause two submissions; distinct files with the same filename remain distinct candidates.
- Reject unsupported files with a short explanation rather than silently discard them from a mixed group.
- File-picker cancellation does nothing. Reset the picker after a selection so the same files can be chosen again.
- If every file is already saved, report that quietly as success, not an error.
- All-success and all-duplicate summaries may disappear after a short interval. Do not add a dismiss control for a successful group.
- Failure details remain available until the user dismisses the result, retries, or starts a new operation. Do not hide actionable errors using the current short success-notice timeout.
- Retrying updates the remaining failures and gives a clear result for that retry. No automatic retry loop.
- Retry results preserve aggregate saved/duplicate counts and permanent failures from the original group, while replacing the recoverable failure entries with their new outcomes.
- Reloading or closing the page ends unfinished work. Already saved images persist; this first version does not promise background completion or resume.

## Visual Rules — DESIGN.md

- Reuse the existing capture surface with `{colors.surface-card}`, `{colors.hairline}`, `{rounded.md}` (16px), and modest `{spacing.lg}` (16px) padding. No new colored panel, shadow, gradient, radius, or font.
- Keep one primary `{component.button-primary}` action: `Choose images`, using `{colors.primary}`, `{colors.on-primary}`, `{typography.button-md}` (14px/700), and `{rounded.md}`. Pressed uses `{component.button-primary-pressed}`. While busy use `{component.button-disabled}`; its unavailable state must also be conveyed by native disabled behavior.
- The main capture instruction uses `{typography.body-strong}` (16px/600) and `{colors.ink}`. Progress replaces the secondary helper text in the existing copy area using `{typography.body-sm}` (14px/400) and `{colors.mute}`. Do not add a heading, percentage badge, animated spinner, or progress-bar row.
- Completion summary replaces progress in the same area, using `{typography.body-sm}` and `{colors.body}`. Only show nonzero counts with correct singular/plural forms. Success and already-saved counts remain neutral; no green banner or status chips.
- Partial-failure summary remains neutral. Use `{colors.error}` for the actual failure explanation, not the entire capture surface, the picker, or retry control. Do not use primary red decoratively for progress or drag feedback; use a neutral border change for drag feedback.
- Keep `View failures` and `Dismiss` as `{component.button-tertiary}` actions. `Retry failed` uses `{component.button-secondary}` with `{colors.secondary-bg}`, `{colors.ink}`, and the secondary pressed state. This hierarchy keeps only one primary-red CTA visible.
- Failure details are initially collapsed and appear directly beneath the compact capture surface in ordinary document flow. They belong to the same capture group but remain outside its sticky portion. No independently scrolling failure list or large pinned error panel. Opening details must not move keyboard focus automatically.
- Render failure entries as a simple textual list, not image cards, tiles, a table, or per-file status pills. Filename and reason use `{typography.body-sm}`. Names wrap within available width without losing access to the full filename. Use `{spacing.sm}` (8px) between entries and `{spacing.md}` (12px) between summary/actions/details.
- Preserve the existing desktop layout and mobile stacking. On phones, the picker spans the available width; secondary actions wrap naturally below the copy. No fixed heights for multiline messages, horizontal scrolling, or reduced text sizes to force a single line.
- Effective targets for picker, disclosure, retry, and dismiss are at least 44 × 44px, following DESIGN.md's Touch Targets rule. Keep the rounded shape and 14px button typography while extending the nominal 40px button height as needed.
- A keyboard-focused picker must have a visible `{colors.focus-outer}` indicator on its visible control, even when its native file input is visually hidden. Disclosure and secondary controls must have equally clear keyboard focus.
- Announce processing and completion politely without moving focus or replaying the full list on every file. Preserve access to filenames/reasons outside the live status message. If an action disappears after retry/dismiss, return focus to a surviving capture control without scrolling the gallery.

DESIGN.md does not define batch progress or inline validation components (see Known Gaps). Their placement and behavior above are feature-specific decisions composed from existing tokens, not additions to the design system.

## Boundaries

This extends feature 001's single-file picker/drop behavior and preserves feature 003's single-URL paste and feature 004's exact duplicate awareness. Capture continues to require no tags or other metadata. Bulk tagging remains a separate deliberate action after saving.

## Non-goals

Folder selection or recursive traversal, ZIP imports, multiple URLs, browser scraping, preview screens, per-file progress bars, reordering, pause/resume, cancellation controls, background jobs, automatic retries, tagging during upload, collections, image processing, cloud storage, new dependencies, or a general upload-management page.

## Acceptance Criteria

- Choose multiple supported images in one native picker interaction; each saved image appears and persists after reload.
- Drop several local images and process each once, with no duplicate submissions from transfer representations.
- Saving one file and canceling the picker preserve the existing lightweight experience.
- A mixed group of new images, duplicates, oversized files, unsupported files, and a request failure produces accurate counts and continues after failures.
- Failure details identify the affected file and reason. Retry processes only recoverable failed files; repeated failure preserves actionable feedback. Invalid/oversized files are explained without offering a futile retry.
- Additional capture attempts cannot overlap the active operation. Normal gallery, search, and viewer interactions remain usable.
- Search/filter context is retained; no automatic scrolling or focus theft occurs as images arrive.
- Progress and results work with keyboard/screen-reader access and fit phone/desktop layouts without horizontal overflow.
- A large failure group remains collapsed by default; opening it does not enlarge the sticky capture area or create nested scrolling. Long filenames remain readable at 320px width.
- Progress/completion reuse the existing copy area. Only the picker uses primary red, all capture controls have at least 44px effective targets, and keyboard focus is visible on the picker.
- No mandatory metadata, new page, backend job system, or dependency is introduced.
