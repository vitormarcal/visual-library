# Implementation

Extend GalleryTagFilters with a native search field, inline tag buttons, and a native details element for all tags. Keep state in app.vue and filter its existing image array with a small normalization/matching helper. Search original filenames, not generated storage identifiers. Remove the database's tag summary limit so all attached tags remain reachable. Keep gallery and adjacent lightbox navigation based on visibleImages. [010](../010-connected-browsing/plan.md) resolves the viewer image from the full library so related exploration can leave those results without changing search or filters.

Validate search matching (accent/case normalization, multiple terms, untagged images, combined criteria), run existing tests, and build Nuxt.
