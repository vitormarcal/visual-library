# Feature: Bulk Tagging

## Problem

Tags currently act as personal memory cues: authors, characters, works, publications, and people. Examples include `manara`, `spider-man`, and `sono bisque doll`. Describing mood or style adds cognitive overhead and is not the user's normal tagging behavior.

Related images often need the same tags. Tagging Playboy scans featuring Mel Lisboa currently requires opening each image and repeating `playboy` and `mel lisboa`.

## Goal

Select saved images in the gallery and add the same tags to all of them in one action, preserving existing tags and calm visual browsing.

## UX Flow

1. Enter selection mode through a small `Select` action near the gallery.
2. Click images to toggle selection, with a quiet visible indicator.
3. Optionally select all images currently displayed by search and filters.
4. A compact contextual area shows the selected count and an action to add tags.
5. Type new tags or choose existing ones, building a small list to apply.
6. Apply those tags to the selected images in one action.
7. Brief success feedback appears and selections clear. Continue selecting or exit selection mode to browse normally.
8. Canceling tag entry discards pending tags without changing images. Exiting selection mode clears selection.

## Scope and UX Rules

- Selection is explicit and temporary. Outside selection mode, tiles open the viewer as usual.
- Allow individual selection, deselection, and selecting all currently displayed images.
- Search and filters remain usable. Images hidden by a changed search or filter leave the selection, so an action never silently affects hidden images.
- Selection controls are contextual; images remain visually dominant.
- Tags stay optional and freeform, including names and phrases with spaces. No categories or descriptive analysis are required.
- Add tags to existing sets. Never replace or remove existing tags.
- Reapplying a tag already present is a quiet no-op for that image.
- Preserve existing whitespace cleanup, case-insensitive identity, and display-name reuse.
- Preserve limits of eight tags per image and 48 characters per tag.
- If any image would exceed the limit, explain the issue near the controls and apply no changes to the group. Preserve selection and pending tags for correction.
- Failed application preserves selection and pending tags for retry, with lightweight contextual feedback.
- Successful changes immediately update gallery filters and tag suggestions.
- Controls and tag entry are keyboard accessible; selected tiles expose an accessible selected state.
- Follow `DESIGN.md`: quiet neutral controls, compact spacing, restrained red, and no metadata panels.

## Non-goals

- Showing common tags, partial tag coverage, counts, or statistics.
- Bulk tag removal or replacement.
- Bulk deletion or other unrelated actions.
- Required tags, capture-time tagging, or save-flow changes.
- Permanent tag labels on gallery tiles.
- Taxonomies, mood/style categories, automatic tagging, or AI suggestions.
- Management pages, sidebars, persistent selection, collections, or general metadata management.

## Acceptance Criteria

- Select several images and apply both `playboy` and `mel lisboa` once to the entire group.
- Existing tags remain intact and duplicate tags are not created.
- Only selected images receive added tags.
- Select-all respects current search and filters; images hidden by changed criteria leave selection.
- Canceling tag entry or exiting selection mode does not change tags.
- Invalid tags or an exceeded per-image limit leave the entire group unchanged with contextual feedback.
- Failed application preserves pending work for retry.
- Successful changes appear immediately and persist after reload.
- Normal browsing and viewer interaction remain available after exiting selection mode.
- Common-tag display, bulk removal, replacement, and management screens are absent.

## Explicit Boundaries

This feature supersedes the no-multi-select and no-bulk-tagging boundaries of features 001, 005, and 006 only for adding tags to selected images. Other organization and metadata boundaries remain in force.

The mood and atmosphere examples in feature 005 are not requirements for tag content. Observed usage confirms that names and contextual memory cues are valid tags.

Common-tag display is deferred for evaluation after actual use of this basic flow.
