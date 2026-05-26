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
- avoid AI tagging;
- avoid complex metadata workflows.

### Viewer feels slightly heavy on mobile
Overlay controls feel too large on narrow screens.

Potential pressure areas:
- lighter mobile chrome;
- smaller controls;
- touch ergonomics;
- calmer overlay spacing.

Avoid:
- gesture complexity;
- cinematic transitions;
- feature-heavy viewer controls.

### images.post.ts is growing
URL saving added network validation and remote fetch logic to the upload route.

Decision:
- acceptable for v1;
- consider extracting URL-fetch validation into a small cohesive module if this route grows again.

Avoid:
- service hierarchies;
- downloader abstractions;
- queue/workers;
- generic network infrastructure.

### Rediscovery still depends mostly on visual memory
The current browsing flow works well for recent saves, and lightweight tags now provide a first rediscovery path. Intentional rediscovery can still feel weak for untagged images, cross-cutting themes, or curated reference groups as the library grows.

Potential pressure areas:
- curated collections;
- small filtering/search surfaces;
- preserving calm visual browsing.

Avoid:
- enterprise search;
- advanced query builders;
- dense metadata panels;
- dashboard-style organization.

### Optional tag suggestions may become useful later
Manual tagging preserves personal visual memory, but adding tags may become repetitive as the library grows.

Potential future direction:
- optional viewer-only tag suggestions;
- user explicitly accepts suggestions;
- no automatic tagging;
- no batch processing;
- no background analysis.

Avoid:
- AI-first tagging;
- provider systems;
- embeddings;
- similarity search;
- automatic metadata generation.