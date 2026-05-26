# BACKLOG.md

This file captures observed product friction and emerging usage patterns.

It is not a commitment list or feature roadmap.

New entries should come primarily from real usage, not speculative completeness.

---

## Observed Frictions

### Hard to rediscover certain images
Browsing works well up to ~150 images, but thematic rediscovery is becoming harder.

### Viewer feels slightly heavy on mobile
Overlay controls feel too large on narrow screens.

### images.post.ts is growing
URL saving added network validation and remote fetch logic to the upload route.

Decision:
- acceptable for v1;
- consider extracting URL-fetch validation into a small cohesive module if this route grows again.
