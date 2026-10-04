# Library search

Search supports rediscovery through original filenames and personally meaningful tags. Shared tag rules are defined in [005](../005-lightweight-tags/spec.md); selection and group additions are defined in [007](../007-bulk-tagging/spec.md).

Keep a search input above the gallery, matching original filenames and manually assigned tags as the user types. Matching ignores case, accents, and repeated whitespace; every typed word must match somewhere in the image's filename or tags. Existing selected tags further narrow the results.

Show up to six most-used unselected tags when the query is empty, matching tag suggestions while typing, and an expandable list that reaches every attached tag. Selecting a suggestion applies the existing exact tag filter and clears the query only when selection succeeds. Keep the three-tag filter limit. Allow clearing text, individual tags, or all filters. Empty results offer quiet explanatory copy. Adjacent viewer navigation follows search results. [Connected browsing](../010-connected-browsing/spec.md) can follow related images across the full library while preserving this search/filter context; adjacent arrows are unavailable outside the results.

Search does not perform semantic image analysis, change metadata, introduce dependencies, or create saved searches. It provides the visible results used by bulk tagging; selection and tag application belong to feature 007.
