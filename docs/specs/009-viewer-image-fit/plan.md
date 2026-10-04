# Implementation: Viewer Image Fit

Use the existing viewer and CSS Module without dependencies or data changes. [010](../010-connected-browsing/plan.md) places its optional Back action in the existing top reserve and preserves this image-fitting layout.

Restructure the main viewing area into a viewport-height grid: a 44px close-control reserve, a flexible image stage, and a compact navigation row. Move previous/next and Explore related into the navigation row. Keep close fixed and align its placement with the reserved top row and safe areas.

Fit the image inside the definite stage dimensions with natural width/height and maximum 100% constraints. Do not cap it at 1180px or reserve side columns. Use dynamic viewport height with fallbacks, 16px phone gutters, and 24px desktop gutters. Controls and their actual wrapping determine remaining stage height.

Move tag display and inline editing after the viewport stage in normal flow; allow long labels to wrap without nested scrolling. Keep related content and all navigation/focus/save behavior intact. Return to image continues scrolling to the top; focusing the tag input should reveal the below-stage editor.

Validate high-resolution portrait, landscape, square, panorama, tall scans, and small originals at phone, rotated phone, tablet, and desktop widths. Measure overlap, aspect ratio, source enlargement, controls, safe-area placement, tag editing, keyboard behavior, related navigation, and gallery return using isolated browser fixtures. Run existing unit tests, production build, and diff checks.

## Validation Results

- `npm test`: all 14 tests passed.
- `npm run build`: passed; existing sourcemap and node:sqlite externalization warnings remain.
- Isolated headless Chrome: 36 proportion/viewport combinations passed across 320 × 568, 390 × 844, 844 × 390, 768 × 1024, 1280 × 900, and 1920 × 1080. Fixtures cover portrait, landscape, square, 1:3 scans, panorama, and small originals. Verified ratio preservation, stage bounds, no control overlap, no horizontal overflow, and no forced source enlargement.
- Eight unbroken 48-character tags remain outside the image and within viewport width. Inline editor receives visible focus, remains in the main scroll flow, and Escape preserves existing edit/close behavior.
- Regression checks passed for related exploration, back-to-image, related-card selection, original gallery tile focus, ArrowRight navigation, untagged images, and non-closing control-row backgrounds.
- Desktop and phone screenshots were visually inspected. Main-image measurements are recorded in spec.md.
- Physical-phone safe areas and software keyboard resizing have not been tested; CSS accounts for safe-area insets and dynamic viewport height, and the editor is in normal document flow.
