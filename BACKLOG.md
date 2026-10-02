# BACKLOG.md

This file captures observed product friction and emerging usage patterns.

It is not a commitment list or feature roadmap.

New entries should come primarily from:
- real usage;
- repeated friction;
- browsing behavior;
- rediscovery difficulty;
- interaction discomfort.

Avoid speculative feature accumulation.

---

## Observed Frictions

### Tags are personal memory cues in current usage

Observed usage on 2026-10-01:
- tags identify authors, characters, works, publications, and people;
- examples include `manara`, `spider-man`, and `sono bisque doll`;
- Playboy scans featuring Mel Lisboa can share `playboy` and `mel lisboa`;
- the user does not usually describe mood, feeling, style, or visual atmosphere;
- choosing descriptive attributes adds cognitive overhead to tagging.

The mood/style examples in feature 005 do not reflect this observed usage. Tags should remain optional, freeform personal memory cues, without requiring descriptive analysis or categories. These examples describe current behavior, not a mandatory taxonomy.

### Repeating the same tags across a group of images

Related images currently need to be opened and tagged individually. A group of scans may need the same two tags on every image.

Selected next scope: explicitly select gallery images and add tags to the group, preserving each image's existing tags and keeping controls contextual. See `docs/specs/007-bulk-tagging/spec.md`.

Showing common tags is deferred until actual use demonstrates a need. Bulk removal, replacement, statistics, and general metadata management are outside this first scope.

### Hard to rediscover certain images
Browsing works well up to ~150 images, but thematic rediscovery is becoming harder.

Current state:
- partially addressed by lightweight tags in `docs/specs/005-lightweight-tags`;
- tags can now be added from the fullscreen viewer and used as temporary gallery filters.

Remaining pressure areas:
- rediscovery still depends on images having been tagged manually;
- broader themes may still need curated collections or very small search/filter affordances.

Potential pressure areas:
- lightweight collections;
- simple filtering/search.

Important boundaries:
- avoid management-heavy organization;
- avoid taxonomy systems;
- avoid automatic metadata expansion;
- avoid complex metadata workflows.

### Rediscovery still depends mostly on visual memory
The current browsing flow works well for recent saves, and lightweight tags now provide a first rediscovery path.

Intentional rediscovery can still feel weak for:
- untagged images;
- cross-cutting themes;
- curated reference groups.

Potential pressure areas:
- curated collections;
- small filtering/search surfaces;
- preserving calm visual browsing.

Avoid:
- enterprise search;
- advanced query builders;
- dense metadata panels;
- dashboard-style organization.

### Optional AI-assisted tag suggestions may become useful later
This remains speculative, not a selected next feature. Current usage favors personally meaningful names; repetitive work should first be addressed by adding tags to a selected group. Atmospheric suggestions have not been requested.

Manual tagging preserves personal visual memory, but adding tags may become repetitive as the library grows.

Potential future direction:
- optional viewer-only suggestions;
- explicit user-triggered suggestion flow;
- user manually accepts suggestions;
- small number of suggestions;
- optional local model or external provider;
- preserving human meaning-making.

Potential uses:
- lightweight tag suggestions;
- short atmospheric descriptions;
- rediscovery assistance.

Avoid:
- automatic tagging;
- background processing;
- embeddings/vector search;
- similarity search;
- AI-first workflows;
- provider-management systems;
- metadata explosion;
- automatic organization.
