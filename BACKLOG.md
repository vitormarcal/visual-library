# BACKLOG.md

This file captures observed product friction and emerging usage patterns. It is not a commitment list or feature roadmap.

New entries should come primarily from real usage, repeated friction, browsing behavior, rediscovery difficulty, and interaction discomfort. Avoid speculative feature accumulation.

## Observed Usage

### Tags are personal memory cues

Observed on 2026-10-01:

- Tags identify authors, characters, works, publications, and people.
- Examples include `manara`, `spider-man`, and `sono bisque doll`.
- Playboy scans featuring Mel Lisboa can share `playboy` and `mel lisboa`.
- The user does not usually describe mood, feeling, style, or visual atmosphere; choosing descriptive attributes adds cognitive overhead.

Tags remain optional and freeform. These observations do not impose a taxonomy or restrict other useful associations. Shared behavior is defined in [lightweight tags](docs/specs/005-lightweight-tags/spec.md).

## Implemented Responses to Friction

### Finding saved images

Visual browsing became less effective for thematic rediscovery at around 150 images.

Implemented:

- Individual viewer tagging and temporary exact tag filters: [005](docs/specs/005-lightweight-tags/spec.md).
- Search by original filename and tags, suggestions of frequently used tags, and access to all attached tags: [006](docs/specs/006-library-search/spec.md).

Search ignores case, accents, and repeated whitespace. Tags remain manually assigned; search does not analyze image content.

### Repeating tags across related images

Opening each image to repeat the same tags created unnecessary work.

Implemented: explicitly select gallery images and add tags to the group, preserving existing tags with all-or-nothing updates: [007](docs/specs/007-bulk-tagging/spec.md).

The implementation exists and automated persistence tests pass. The feature plan records browser interaction checks as pending; actual-use evaluation is still needed before expanding this flow.

### Exploring connections between images

Implemented: the viewer can reveal up to six images sharing tags within the current search/filter results. Selecting one continues in the same viewer while preserving gallery context: [008](docs/specs/008-related-images/spec.md).

This supports exploration of existing personal associations. Untagged images still require useful filenames or visual browsing.

### Main-image viewing space

The selected image was narrower than related cards on phones, capped unnecessarily on large desktops, and sometimes covered by tags. Addressed by viewport-based image fitting, navigation below the image, and tags outside the viewing stage: [009](docs/specs/009-viewer-image-fit/spec.md).

## Remaining Friction and Open Questions

### Rediscovery with little textual context

Images without useful filenames or manually assigned tags still depend on visual memory. Search and filtering address known textual cues, but do not establish whether cross-cutting themes or curated reference groups need another interaction.

Observe actual use before selecting further work. Curated collections remain a possible direction, not a committed feature.

Preserve calm visual browsing. Avoid taxonomy systems, enterprise search, advanced query builders, dense metadata panels, and automatic metadata expansion.

### Evaluating group tagging

Observe whether additive group tagging removes the repeated work that motivated it.

Showing tags shared by selected images is deferred until usage demonstrates a need. This is separate from the existing gallery suggestions of frequently used tags. Bulk removal, replacement, statistics, and general metadata management remain outside the current scope.

### Optional AI-assisted suggestions

This remains speculative, not a selected next feature. Atmospheric suggestions have not been requested. Evaluate existing manual entry, search, and group additions before introducing assistance.

Any future exploration should preserve personally meaningful tags and explicit user choice. Avoid automatic tagging, background processing, embeddings/vector search, similarity search, provider-management systems, and automatic organization.
