# Multiple Image Save — DESIGN.md Review

Date: 2026-10-04. This review was completed before implementation. The approved feature is now implemented; validation is recorded in [plan.md](plan.md).

Sources: [DESIGN.md](../../../DESIGN.md), [CONSTITUTION.md](../../../CONSTITUTION.md), [feature specification](spec.md), and the existing SaveDropzone component/CSS. No external design system or competitor pattern is required.

## Assessment

The feature fits the current visual direction when multiple selection extends the existing capture action. A native picker, incremental gallery updates, and a compact processing message preserve image-first browsing. The original proposal needed explicit rules for failure presentation, typography, color hierarchy, and the height of sticky content.

These refinements were incorporated into spec.md before application changes. The implementation reuses existing DESIGN.md tokens without changing DESIGN.md.

## Findings and Resolutions

| Finding | Relevant DESIGN.md rule | Resolution in the specification |
|---|---|---|
| An expanded failure list inside the existing sticky dropzone could dominate the viewport. | Overview: chrome gets out of imagery's way; Layout: discovery chrome remains compact. | Keep the summary compact and details collapsed by default; render expanded details below the sticky surface in normal flow. |
| Progress had no defined placement or text role. | Typography hierarchy and Iteration Guide: reference existing tokens. | Replace secondary helper copy with 14px body-sm progress; completion uses the same location. No additional heading or progress row. |
| Styling a mixed result entirely as an error would visually exaggerate one failed file. | Semantic colors; Do's: primary red is reserved for primary CTAs. | Neutral aggregate summary; semantic error text only where the failure is explained. No red panel or decorative progress accent. |
| Picker and retry could compete as primary actions. | Iteration Guide: at most one primary-red CTA per fold. | Picker remains primary; retry is secondary; disclosure/dismiss are tertiary. |
| Long filenames and many failures were unspecified. | Responsive Behavior and Typography: preserve legibility across breakpoints. | Wrap filenames, use readable 14px text, and show a plain list on demand without a nested scroll area. |
| Existing picker styling has a nominal 40px target and a hidden native input. | Touch Targets requires effective 44 × 44px targets; Inputs & Forms defines visible focus. | Specify at least 44px effective targets and a visible focus indicator on the visible picker control. |
| Busy and pressed states were loosely described. | Existing primary-pressed, secondary-pressed, and disabled components. | Name these variants directly and require actual disabled interaction behavior. |
| Retrying permanently invalid files would offer an action that cannot help. | CONSTITUTION.md: low friction and minimal cognitive overhead. | Retry potentially recoverable failures only; explain unsupported/oversized files directly. This is a UX refinement, not an explicit DESIGN.md prescription. |

## Starting Implementation Considerations

The original dropzone had a warm neutral surface, 16px corners, and a single red picker, so its structure could be reused. The review identified:

- The current disabled picker uses secondary-bg rather than DESIGN.md's disabled surface-card variant.
- The visible picker is a label attached to a clipped file input. Keyboard focus on that input needs a visible indicator on the label/control.
- The current drag state uses primary red on the border. The proposed specification uses neutral feedback to follow the primary-accent restriction.
- The current notice sits inside sticky content and disappears after a short timeout. Recoverable failure details need persistent feedback outside the pinned portion.

The implementation addresses these findings through disabled styling, a native visible picker button, neutral drag feedback, and a failure section outside the sticky capture surface. See plan.md for validation and remaining manual checks.

## Validation Needed After Implementation

- Inspect idle, processing, all-success, all-duplicate, mixed-failure, all-failed, expanded-details, retry, and dismissed states.
- Compare 320/390px phones, tablet, and desktop, including long unbroken filenames and a large failure group.
- Verify that progress changes do not add per-file layout movement, primary actions remain visually unambiguous, and expanded details do not occupy a growing sticky panel.
- Verify native picker keyboard access, visible focus, 44px effective targets, disclosure focus, and polite announcements without repeating the full error list.
- Assess with real collection imagery after synthetic checks. This review establishes specification alignment, not final visual quality.
