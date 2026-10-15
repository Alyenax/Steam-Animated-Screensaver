# Validation report — 0.1.0 private candidate

This report distinguishes executed software checks from intended SteamOS behavior. The initial implementation/validation host is macOS arm64 on 2026-10-15. The target package is Linux x64. No physical Steam Deck, Steam Machine, Linux desktop, controller, Steam CEF or Gaming Mode session was available.

Test totals, archive sizes and checksum verification are recorded below; the distributed SHA256SUMS identifies the final archive. Do not infer physical compatibility from passing unit tests or a successfully created archive.

## Evidence scope

| Area | Evidence | Boundary |
| --- | --- | --- |
| Scanner | Temporary real VDF/ACF files, missing Steam, corrupted manifests, duplicate and >100 games, secondary libraries, uninstallation/rescan | Not a scan of a real SteamOS installation |
| Unified catalog | Manual/installed merges, verified mappings, preservation of preferences/manual assets/cache, process lock and corrupt recovery | Unknown SGDB-only identity cannot be merged offline without an authoritative mapping |
| SteamGridDB | Official API/spec research; mocked errors/rate limits; live valid-key name/AppID/Store URL search, thumbnails, manual addition and real animated Hero downloads on Portal 2 and Cyberpunk 2077 | Temporary key supplied by the user, accepted by the service; key/downloads/live captures removed after testing. Homonyms and HTTP 429 use deterministic mocks. |
| Preparation | Real FFmpeg/FFprobe on original GIF, animated WebP, WebM and AV1→VP9; source byte preservation; corrupt media, storage ceiling, pause/reopen/resume/cancel/retry | Target hardware speed, GPU/memory/energy not measured |
| Files/network | HTTPS CDN/redirect restrictions, size/time limits, signatures before decoding, traversal/symlink rejection, key redaction/permissions, host/origin checks | Not an external security audit |
| Player | Real Chromium playback, actual downloaded animated WebP playback from local files, pause, navigation, transitions, missing-media skip, decoder bounds, resizing and cleanup | Does not establish Steam's bundled CEF codec behavior or activity dismissal |
| Installer | Isolated temporary Steam folder, atomic owned replacement, rollback, refusal of unowned files/symlinks, uninstall preserving neighbors | Correct files do not prove Steam discovers/executes them |
| Interface | Actual app browser screenshots, mocked provider with original test media, both languages and responsive checks | No fabricated game library shipped; captures identify QA media |
| Electron | Native macOS Electron launch, actual app:// video playback/pause, forbidden action/path rejection, renderer Node isolation, sandbox and lock release | No macOS support release and no Linux execution claim |
| Packaging | Local Linux x64 cross-package, archive/checksum and manifest inspection | Not a Linux runtime test |

## Remaining acceptance work

1. Run the Linux package in SteamOS Desktop Mode and another Linux x64 graphical desktop without adding sandbox-bypass flags. Check system dependencies, shortcut, update and removal.
2. Repeat personal-key validation on the target installation, including animated Grid composition, slow/offline recovery and rate limiting. Live name/AppID/Store URL lookup and animated Heroes have passed locally. Never publish the key or downloaded media.
3. Install/select in current Steam Gaming Mode. Confirm idle entry, GIF/WebP/VP9 CEF decoding, all transitions and next-scene timing, offline playback with the manager closed, keyboard/mouse/controller wake and immediate dismissal without leaked media/processes.
4. Measure Steam Deck 1280×800 readability/touch targets, TV 1080p/4K rendering, video decoder count, RAM/GPU use, thermals and battery behavior. Test the preparation game-detection guard with the manager launched from Desktop Mode and as a Steam shortcut.
5. Complete exact corresponding-source and notice review for redistributed GPL media binaries before any public binary release. No private Lab rights are assumed.

## Deliberate limits

Owned-account import and Windows compatibility are deferred. Automatic aesthetic loop/black-frame analysis is not implemented. Titles can be toggled; baked-in logos cannot be removed and separate SteamGridDB logos are not downloaded. Reduced motion removes interface transitions and still-image drift while leaving true artwork animation intact. The inactive manager uses no permanent service.

## Final executed results

- `npm test`: **56 passed, 0 failed, 0 skipped**. Includes 30 Core tests, actual FFmpeg fixtures/conversion and real Chromium tests for animation, stable GIF/WebP pause, transitions and direct-file export.
- `npm run check`: source syntax and no-workflow checks passed. Shell installation/removal scripts pass `sh -n`.
- `node scripts/ui-qa.cjs --capture`: passed 12 integration checks with 0 uncaught browser errors; all five spaces at 1280, 800 and 390 pixels in English/French without horizontal overflow. Evidence: `screenshots/EVIDENCE.json`.
- `node scripts/electron-qa.cjs`: native macOS Electron app passed actual `app://` media playback and pause, forbidden path/action rejection, sandbox/context-isolation/Node-off checks and lock release. The native preview screenshot is `screenshots/09-electron-preview-qa.png`.
- Live personal-key integration: Portal 2, SGDB 17830, animated Hero 29084 by Moofy, WebP 1920×620, approximately 6.297 seconds; Cyberpunk 2077, SGDB 5209422, animated Hero 130287 by fewwan, WebP 3840×1240, approximately 15.033 seconds. Both prepared and played locally with zero HTTP requests after manager close. Exact metadata: LIVE_VALIDATION.json. Temporary key, downloaded media and live screenshots removed; only public metadata/evidence retained.
- `npm audit` (full and production scope): **0 reported vulnerabilities** at validation time. This is registry advisory evidence, not a full executable security audit.
- Local Linux x64 cross-package created. The manager executable is ELF x86-64; included Linux FFmpeg and FFprobe are static ELF x86-64, rather than the macOS development binaries. Archive approximately **174 MiB compressed / 443 MiB installed**. Exact current bytes and digest are in release metadata/SHA256SUMS. Archive contents exclude node_modules, credentials, local catalog, QA source media and Git data.
- GitHub Actions disabled before the first push; no workflows provided. Repository `Alyenax/SteamOS-Animated-Screensaver`, branch `codex/initial-candidate`, private prerelease `v0.1.0-rc.1`.

No Linux process, physical SteamOS screensaver or controller wake result is inferred from these checks.
