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