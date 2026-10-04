# Feature: Lightweight Tags

## Goal

Use optional, freeform tags as personal memory cues to rediscover saved images. Tags may identify authors, characters, works, publications, people, themes, or any association useful to the user. Examples include `manara`, `spider-man`, `sono bisque doll`, `playboy`, and `mel lisboa`.

No descriptive analysis, mood/style vocabulary, categories, or mandatory taxonomy is required. These examples describe observed usage, not restrictions on tag content.

This spec defines shared tag behavior and individual editing. [Library search](../006-library-search/spec.md) defines gallery discovery controls; [bulk tagging](../007-bulk-tagging/spec.md) defines additions to selected groups.

[Visual tag exploration](../012-visual-tag-exploration/spec.md) adds a visual directory of existing tags. In a subject gallery, the base tag counts toward the three-filter limit and remains when refinements are cleared, including when its last image disappears. Tag editing remains optional and freeform.

## User Flow

1. Save images without being asked for tags.
2. Open an image in the fullscreen viewer.
3. Read existing tags as quiet chips, or use `+ Add tag` when none exist.
4. Use the add/edit affordance to open a compact inline editor.
5. Type a tag or phrase and press Enter, or choose an existing suggestion. Each addition saves immediately.
6. Remove a tag from the inline editor; each removal saves immediately.
7. Close the editor with Done or Escape. This ends editing; it does not undo saved changes.
8. Click a normal viewer tag to close the viewer and filter the gallery by that tag.

## Shared Tag Rules

- Tags are optional and may contain spaces.
- Enter confirms the whole typed phrase; commas do not split tags.
- Trim outer whitespace and collapse repeated internal whitespace.
- Compare identity case-insensitively and preserve human-readable display names.
- Reuse the existing display name when a case variant of a stored tag is entered.
- Do not force kebab-case, hashtags, aliases, or semantic merging.
- Punctuation variants such as `spider man` and `spider-man` remain distinct.
- Allow up to eight tags per image and 48 characters per tag after whitespace cleanup.
- Ignore empty input and do not create duplicate associations.
- Keep validation feedback small and near the editor.

## Viewer and Filtering Rules

- All image tags are visible in the viewer, wrapping if necessary.
- Normal chips filter; removal controls appear only while editing.
- Entry suggestions reuse existing tags, show at most five matches, and remain secondary to free typing.
- Clicking a viewer tag adds an exact tag filter and closes the viewer when selection succeeds. At the three-filter limit, keep the viewer open and show quiet feedback.
- Multiple exact tag filters require every selected tag to be present.
- Tag changes update local image state and discovery suggestions without reloading the page.
- Keep the viewer open when edits move its image outside search/filter results, as defined in [010](../010-connected-browsing/spec.md).
- Preserve selected filters during individual editing, even when they have no matches; users can clear them explicitly. Image deletion still removes filters whose tags are no longer attached anywhere.
- Tags remain absent from gallery tiles and the capture surface.
- Viewer navigation, keyboard access, and image proportions remain intact.
- Follow `DESIGN.md`: compact neutral controls, restrained red, and images as the dominant content.

## Non-goals

- Required or capture-time tagging.
- Permanent metadata on gallery tiles.
- Tag management pages, descriptions, colors, hierarchies, or aliases.
- Automatic tagging, AI suggestions, or semantic categories.
- Saved searches, query syntax, advanced filter panels, or metadata inspectors.
- Combining tags and collections into one abstraction.

## Acceptance Criteria

- Save an image without metadata prompts.
- Add `manara` and a phrase such as `sono bisque doll` from the viewer; verify immediate display and persistence after reload.
- Reuse `MANARA` without creating another tag or changing its stored display name.
- Remove tags only from the inline editor.
- Enforce the eight-tag and 48-character limits with contextual feedback.
- Use a normal viewer chip to filter the gallery and combine up to three exact tag filters.
- Reflect edits and deletions in visible images, active filters, and tag suggestions.
- Keep tags off gallery tiles and preserve calm browsing and keyboard navigation.


## Navegação persistente (013)

[013](../013-persistent-subject-navigation/spec.md) implementa endereços para os contextos existentes, busca/filtros no endereço, reload e Voltar/Avançar. Refinamentos substituem a entrada atual; não são buscas salvas. O visualizador mantém uma camada sobre a galeria de origem, e o retorno explícito a Explore usa a origem interna conhecida ou um destino seguro. Mantêm-se a tag base protegida, o limite de três e a aparência de 012.
