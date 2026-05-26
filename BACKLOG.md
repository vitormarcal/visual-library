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

Potential pressure areas:
- lightweight tags;
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
The current browsing flow works well for recent saves, but intentional rediscovery remains weak as the library grows.

Potential pressure areas:
- lightweight tags;
- curated collections;
- small filtering/search surfaces;
- preserving calm visual browsing.

Avoid:
- enterprise search;
- advanced query builders;
- dense metadata panels;
- dashboard-style organization.