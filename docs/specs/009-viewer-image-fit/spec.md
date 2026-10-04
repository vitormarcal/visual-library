# Feature: Viewer Image Fit

Status: approved and implemented. Validation is recorded in [plan.md](plan.md).

## Problem

The main image reserves side space for navigation and applies fixed height deductions unrelated to the actual controls. On phones this makes the selected image narrower than related cards. Absolutely positioned tags can overlap tall images; wide desktops retain a 1180px image cap despite available space.

Headless Chrome measurements using high-resolution synthetic images and two tags:

| Viewport | Image ratio | Current main image | Related section width | Observation |
|---|---|---|---|---|
| 390 × 844 | 3:4 | 302 × 403 | 358 | Unnecessary side reservation |
| 390 × 844 | 16:9 | 302 × 170 | 358 | Same mobile width restriction |
| 390 × 844 | 1:3 | 244 × 732 | 358 | Tag controls overlap the image |
| 844 × 390 | 16:9 | 416 × 234 | 796 | Height deduction and tags overlap |
| 1280 × 900 | 16:9 | 1089 × 613 | 960 | Width lost to side navigation columns |
| 1920 × 1080 | 16:9 | 1180 × 664 | 960 | Arbitrary desktop cap limits viewing |

Measurements are CSS pixels in emulated viewports, not physical-phone validation. Related imagery is not height-fitted, so equal widths are not always desirable: a very tall main image must remain narrow enough to fit fully.

## Goal

Show the largest clear, uncropped image that fits the available viewing area, without controls or tags covering it. Preserve the calm viewer and related exploration specified in [008](../008-related-images/spec.md).

## Layout

1. A compact top row reserves space for close and the optional Back control from [010](../010-connected-browsing/spec.md), outside the image area. Keep close reachable while scrolling related content and account for device safe areas.
2. The image occupies the remaining central area, centered both vertically and horizontally, at its natural ratio.
3. A compact bottom row holds previous/next controls and, when matches exist, the separately grouped Explore related shortcut.
4. Tags and their inline editor follow the viewing area in normal document flow. They remain easy to reach by scrolling but do not compete with the initial fitted image.
5. Related images continue after tags on the same dark surface. Explore related bypasses the tag area and reaches the existing section directly.

One viewer scroll container; no secondary panel, hidden controls, or interaction mode. Navigation stays visible, keyboard-accessible, and predictable.

## Fitting Rules

- Fit both width and height to the actual space remaining between the control rows, including their real wrapping, viewport height, safe areas, and gaps.
- Use 16px horizontal phone gutters; desktop gutters stay modest, around 24px. Do not reserve permanent image-side columns for arrows.
- Remove the 1180px image cap. The viewport and natural image ratio determine useful size; gallery container limits do not constrain an immersive viewer.
- Preserve the entire image: no cover crop, aspect-ratio distortion, or stretching just to eliminate letterboxing.
- Avoid forced enlargement of small source images. Higher-resolution originals may use the available space; do not promise extra detail beyond source resolution.
- React to rotation and usable viewport changes. When the browser keyboard appears during tag editing, keep the editor reachable without compressing the main image for every normal viewing session.
- A portrait on a wide desktop still has side whitespace; a landscape on a tall phone still has vertical whitespace. These are necessary consequences of showing the whole image.
- Extremely tall scans fit completely in the initial view. Zoom, native-size scrolling, and pan are separate features outside this proposal.

## Visual and Interaction Rules — DESIGN.md

- Preserve colors.surface-dark, natural image ratios, rounded.md (16px) image corners, quiet neutral controls, and no extra shadows or decorative red.
- Close and previous/next use familiar circular controls with effective targets of at least 44 × 44px.
- Use spacing.sm (8px) and spacing.lg/xl (16/24px) around viewing controls. Control rows remain compact and do not become toolbars with unrelated commands.
- Keep Explore related visually distinct from previous/next and tag chips; preserve its current label and arrow direction.
- Tag display follows shared rules in 005, including all tags being accessible, optional editing, and contextual feedback. Long phrases wrap within the viewport.
- Preserve original gallery scroll and return-focus context; keep existing adjacent navigation, related-card navigation, and pending tag-save protection.
- Closing, Escape, and background click retain their expected behavior. Clicking control-row backgrounds must not accidentally close the viewer.
- Base viewer and related-image documentation reference this layout for image fitting and control placement.

## Expected Improvements

For a high-resolution 3:4 image at 390px phone width, removing the side reservation permits approximately 358 × 477px instead of 302 × 403px: about 19% more width and 40% more displayed area.

For a high-resolution 16:9 image at 1920 × 1080, the image could approach 1670px wide instead of 1180px, depending on final control-row dimensions. This is an estimate, not a promised measurement; actual remaining height and safe areas govern the result.

Tall images may gain little or become slightly smaller if additional space is required to keep controls outside the image. Complete visibility and unambiguous interaction take precedence over nominal pixel area.

## Non-goals

Zoom/pan, cropping, image editing, immersive toggles, automatic hiding of controls, new gestures, metadata drawers, relatedness changes, thumbnail infrastructure, settings, or dependencies.

## Acceptance Criteria

- At 390px width, width-limited main images use approximately the same 16px gutters as related imagery.
- No tag, close button, navigation button, or shortcut covers image content.
- High-resolution landscape images can exceed 1180px on large screens when both dimensions permit.
- Portrait, landscape, square, panorama, tall scan, and low-resolution image fixtures retain natural ratios and full visibility.
- Verify 320/390px phones, phone landscape, tablet, 1280px desktop, and 1920px desktop; test with no tags, eight long tags, and tag editing.
- No horizontal overflow, inaccessible controls, or nested scrolling is introduced.
- Gallery return, keyboard focus, safe-area layout, related navigation, and reduced-motion behavior remain intact.
- Confirm final sizes in the browser and visually inspect desktop/mobile screenshots. Validate real phone viewport/keyboard behavior when available.

## Measured Results

Chrome validation with high-resolution synthetic fixtures:

| Viewport | Ratio | Before | After |
|---|---|---|---|
| 390 × 844 | 3:4 | 302 × 403 | 358 × 477 |
| 390 × 844 | 16:9 | 302 × 170 | 358 × 201 |
| 390 × 844 | 1:3 | 244 × 732, controls overlapping | 241 × 724, no overlap |
| 844 × 390 | 16:9 | 416 × 234 | 480 × 270 |
| 1280 × 900 | 16:9 | 1089 × 613 | 1217 × 685 |
| 1920 × 1080 | 16:9 | 1180 × 664 | 1678 × 944 |

A 160 × 120 original remains 160 × 120. Height-limited images retain the complete frame and sacrifice a few pixels where needed to separate controls.
