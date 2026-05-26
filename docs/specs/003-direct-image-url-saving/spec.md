# Feature: Direct Image URL Saving

## Problem

Saving images from the web still has unnecessary friction when the user already has a direct image URL. The current capture flow is intentionally lightweight, but it requires an image file, clipboard image data, or local upload. A pasted direct image URL should feel like another way to capture the same visual thought, not like starting an import workflow.

## Goal

Let a single local user paste a public direct image URL into the existing save surface and have the image downloaded, stored, and inserted into the gallery with the same lightweight feel as paste, drag-and-drop, and local upload.

The feature should reduce web image saving friction while preserving the current image-first capture model and avoiding any movement toward bookmarking, scraping, or webpage extraction.

## User Flow

1. User finds a direct image URL on the web.
2. User copies the image URL.
3. User focuses the existing save surface and pastes.
4. If the pasted text reasonably looks like a URL, the app treats it as URL save intent.
5. If the URL is a supported public direct image URL, the app shows a subtle temporary saving state while the image is fetched and stored.
6. After successful save completion, the image appears in the gallery immediately.
7. The user remains in the same library view and continues browsing or saving.
8. If URL saving fails, lightweight non-blocking feedback explains the failure without opening a modal, clearing the gallery, or moving the user into a separate workflow.

## Scope

- Direct image URL saving through paste only.
- URL handling inside the existing unified save surface.
- Lightweight intent detection for pasted text.
- Immediate save after a valid direct image URL is pasted.
- Subtle in-place saving state while the remote image is downloaded and stored.
- Lightweight non-blocking failure feedback.
- Same visual gallery insertion behavior as existing save methods.
- Same allowed image formats as local image saving: JPEG, PNG, WebP, GIF, and AVIF.
- Same maximum image size as local image saving: 15 MB.
- Store the original direct image URL internally as lightweight metadata.
- Do not display the original URL in the UI.
- Single-user local library assumptions.

## Non-goals

- Drag-and-drop URL saving.
- Separate URL import panels, tabs, modes, dialogs, or forms.
- Preview screens, confirmation dialogs, import wizards, or multi-step flows.
- Webpage scraping, HTML parsing, OpenGraph extraction, social media extraction, or "find image on page" behavior.
- Browser automation, headless browsers, recursive asset discovery, queues, workers, or scraping infrastructure.
- Bookmarking behavior, link previews, hostname badges, attribution UI, source labels, source notes, or metadata panels.
- Required titles, descriptions, tags, collections, or other user-entered metadata.
- Support for non-image URLs, webpage URLs, file URLs, data URLs, blob URLs, FTP URLs, or other non-HTTP protocols.
- SVG support.
- Authentication, cloud sync, multi-user support, sharing, collaboration, or platform-oriented import systems.

## UX Rules

- The existing save surface remains one unified lightweight capture area.
- URL saving must feel like another capture path, not a separate import workflow.
- The save surface should still feel primarily image-oriented, not form-oriented.
- The user should be able to paste a direct image URL, paste an image from the clipboard, drag/drop an image file, or upload a local image without switching modes.
- URL-specific UI should remain visually subtle.
- Do not introduce a dedicated URL form, URL tab, URL panel, or modal.
- If pasted text does not reasonably look like a URL, ignore it quietly.
- If pasted text clearly appears to be a URL, attempt URL handling and show lightweight non-blocking feedback on failure.
- Saving should be immediate after paste; no preview or confirmation step.
- The gallery remains visible before, during, and after URL saving.
- Successful URL saves appear in the gallery immediately after save completion.
- Failure feedback must not interrupt browsing or turn normal clipboard usage into noisy errors.
- The source URL must not be displayed in the gallery, viewer, tile chrome, or save surface after saving.
- The UI follows `DESIGN.md`: image-forward composition, minimal warm neutral chrome, rounded controls, and restrained red usage.

## URL Handling Rules

- Only `http` and `https` URLs are allowed.
- The pasted URL must itself resolve to an allowed image response.
- Standard redirects are allowed when the final resolved response is still a supported public image response.
- The initially pasted URL and final resolved target after redirects must both be public-network HTTP(S) targets.
- Reject private, local, loopback, link-local, unique-local, and otherwise non-public network targets by default.
- Reject `localhost`.
- Reject loopback addresses such as `127.0.0.1` and `::1`.
- Reject private IPv4 ranges such as `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`.
- Reject link-local ranges such as `169.254.0.0/16`.
- Reject unique-local IPv6 ranges.
- Reject `file://` and all non-HTTP(S) protocols.
- If the final response is not an allowed direct image response, the save fails with lightweight non-blocking feedback.
- Do not parse HTML or inspect webpage content to locate images.
- Do not follow webpage-level references, social media metadata, OpenGraph tags, scripts, or embedded assets.

## Validation Rules

- URL saves use the same allowed image formats as local saves:
  - JPEG
  - PNG
  - WebP
  - GIF
  - AVIF
- SVG remains disallowed.
- URL saves use the same maximum file size as local saves: 15 MB.
- Reject responses declaring a size above 15 MB.
- Reject downloads that exceed 15 MB while being read.
- Reject responses that are not an allowed image type.
- Reject failed downloads.
- Reject timed-out requests.
- URL fetches should fail quickly.
- Prefer a short timeout suitable for interactive capture behavior.
- Suggested maximum timeout: 5-10 seconds.
- Reject unsupported or unsafe hosts.

## Feedback

- Successful save feedback should remain subtle and transient, matching the existing save flow.
- A temporary saving state may appear while the remote image is being downloaded and stored.
- Failed URL saves should use short, non-blocking messages.
- Unsupported or unsafe URL failures may use generic copy such as: "This image URL cannot be saved."
- Oversized URL saves should use: "Image is too large. Maximum size is 15 MB."
- Failure feedback should stay near the save surface or in the same lightweight notice area used by existing save errors.

## Metadata

- The original direct image URL should be stored internally as lightweight metadata.
- The URL should not be shown in v1 UI.
- Storing the URL is for future debugging, deduplication, provenance, or optional source actions.
- The existence of stored source metadata must not introduce source-first browsing, bookmark management, attribution UI, or metadata editing in this feature.

## Acceptance Criteria

- A user can paste a direct public image URL into the existing save surface.
- A supported direct image URL saves immediately after paste without preview, confirmation, modal, or route change.
- The save surface continues to support clipboard image paste, local image drag/drop, and local upload.
- Drag-and-drop remains limited to local image files in v1.
- The save surface remains a unified capture area, with no URL-specific panel, tab, mode, modal, or dedicated import form.
- Pasted text that does not reasonably look like a URL is ignored quietly.
- Pasted text that clearly looks like a URL triggers URL handling.
- A saved URL image appears in the gallery immediately after successful save completion.
- The UI shows a subtle temporary saving state while a remote URL image is being fetched and stored.
- Failed URL saves show lightweight non-blocking feedback while the gallery remains usable.
- The original direct image URL is stored internally but not displayed in the UI.
- Only public `http` and `https` direct image URLs are allowed.
- The initial URL and final redirected target reject private, local, loopback, link-local, unique-local, and non-public network targets.
- Standard redirects are supported only when the final response is still an allowed public direct image response.
- Webpage URLs, HTML responses, social media pages, OpenGraph extraction, scraping, browser automation, and recursive asset discovery are not supported.
- URL saves accept only JPEG, PNG, WebP, GIF, and AVIF.
- SVG remains unsupported.
- URL saves enforce the same 15 MB limit as local uploads.
- The feature assumes one local user and provides no multi-user, sharing, collaboration, or platform import behavior.
- The UI follows the visual direction in `DESIGN.md`.
