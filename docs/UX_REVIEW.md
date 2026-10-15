# Independent UX review

Reviewed 15 October 2026 by an agent independent of Manager implementation. The review used actual running Manager screenshots, source inspection, and an isolated Chrome session with temporary QA catalog data. It did not use generated product screenshots or alter a user's library.

## Evidence and scope

Inspected `screenshots/01-home-onboarding.png`, `02-home-prepared-qa.png`, `03-my-library-qa.png`, `04-add-game-qa.png`, `05-preparation-qa.png`, `06-preview-qa.png`, `07-settings.png`, and the narrower French `manager-library-portrait.png`. These captures show original self-authored QA animations clearly identified as validation media, not SteamGridDB artwork or a real customer's library. The initial review used the first capture set; the implementation lead later regenerated the captures after the fixes. The reviewer also inspected final `08-library-1280-fr-qa.png`, `08-library-800-fr-qa.png` and `08-library-390-en-qa.png`. These final views retain card hierarchy and wrap the filters without clipping the page.

The desktop presentation has a coherent dark palette, restrained cyan, clear active navigation, large visual cards, an explicit empty state, legible hierarchy, and a faithful Player iframe. It avoids a dense administrative layout. The narrower library wraps its filters and retains readable names. Those observations establish a workable visual foundation, not Steam Deck hardware acceptance.

## Findings addressed

| Priority | Initial problem | Change verified |
| --- | --- | --- |
| P1 | Prepared animated WebP/GIF showed only still thumbnails in Home, library hover and game detail, undermining the product's main feature. | Source now uses the actual local animated image in Home/detail and temporarily swaps a single hovered image. WebM uses video; reduced-motion settings retain still previews. |
| P1 | Game details lacked a moving preview and duration. | Source now creates a local video/image preview and shows duration, dimensions, format and artist; unknown duration is labeled. |
| P1 | Navigation, settings saves and progress refreshes discarded keyboard focus. | An isolated live test first observed `document.activeElement === BODY` in all three cases. After the patch, navigation retains the Settings button, saving scene duration retains the next Shuffle checkbox, and a progress update retains Pause. |
| P1 | Add Game and artwork dialogs discarded focus when their contents were replaced. | Source now restores the search input or first enabled result and preserves artwork-choice/action focus and dialog scroll. A targeted live Add Game re-test retained the search input rather than BODY. |
| P1 | Completion copy claimed that scenes were ready even when included games failed or had no artwork; the next step was hidden in Settings. | Source now distinguishes partial completion with playable/pending counts and offers Preview plus Install/Update actions after the job. Missing-artwork queue rows are labeled explicitly. |
| P2 | Home counted unprepared games as already being in the playback rotation. | The count is now labeled “Included games”; playable scenes remain a separate count. |
| P2 | “Pause when a game starts” implied control of screensaver playback. | The control now explicitly pauses preparation during detected Linux Steam games. |
| P2 | Manual search advertised only names, concealing Steam AppID and Store URL support. | The search placeholder and hint now advertise all three entry methods. |
| P2 | Card inclusion controls and preview icon buttons were small for touch. | Source now provides 44-pixel card inclusion hit areas and minimum 44-pixel icon buttons while preserving compact visual glyphs. Ordinary text buttons remain smaller and need device evaluation. |
| P2 | Job-only polling rebuilt Home/Library and restarted existing animation. | Source now snapshots full state for Preparation and excludes `job` from render-change comparison elsewhere. State is still refreshed; real catalog/settings/storage changes still redraw. Resolved by source inspection; animation continuity was not independently re-tested at runtime. |
| P2 | The download label displayed the latest asset's byte count as though it represented the whole job. | Core now accumulates bytes across downloads and fallback attempts. A regression test verifies the total. |

## Pending findings and validation

- **P2, portable-device ergonomics:** desktop screenshots and narrow browser views do not establish physical Steam Deck legibility or touch comfort. Check 1280×800 at native scaling, long translated titles, Settings scrolling, modal results, and all primary controls on a physical device.
- **P2, controller navigation:** desktop keyboard paths exist; controller navigation and fullscreen exit using a controller remain unvalidated.
- **P3, title overlays:** the current option is accurately named “Show game titles”. Actual game-logo acquisition/placement is not implemented and should not be advertised as finished.
- A later live integration used a user-supplied temporary key successfully on Portal 2 and Cyberpunk 2077; see LIVE_VALIDATION.json. That live Core/player check is separate from this UX review. The QA search capture deliberately uses labeled synthetic results, so its placeholder thumbnails are not evidence of live API artwork retrieval.

## Browser checks

An isolated temporary Manager server and Chrome at 1280×800 were used to reproduce focus loss and verify the first correction. No real games, keys, prepared files, or Steam installation were used. Native dialogs, keyboard focus restoration, and retained preview controls were reviewed alongside the existing Manager smoke test. Fullscreen input, screen-reader announcements, contrast ratios, physical gamepad behavior and Steam Gaming Mode remain separate acceptance work.

## Release assessment

The initial review found substantive interaction problems behind an otherwise consistent visual design. All identified implementation findings now have source fixes, and the main-window and Add Game focus corrections were independently re-tested in Chrome. Final responsive library captures were inspected after regeneration. The implementation lead's final `screenshots/EVIDENCE.json` records successful five-space checks in both languages at 1280/800/390 pixels, direct-file offline playback and zero browser errors; those broader checks are separate from the reviewer's targeted tests. Physical Steam Deck, controller and Steam Gaming Mode acceptance remain pending, alongside the explicitly unimplemented actual-logo feature.
