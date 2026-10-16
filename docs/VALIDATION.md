# Validation report — 0.1.7 macOS app and private Linux candidate

This report distinguishes executed software checks from intended SteamOS behavior. The initial implementation/validation host is macOS arm64 on 2026-10-15. The SteamOS target package is Linux x64; 0.1.7 additionally provides a native macOS arm64 Manager/Preview app. There is no direct remote access to a physical Steam Deck/Steam Machine or Linux desktop. The user subsequently reported a failed Steam Machine/Gamescope screensaver launch on 0.1.0, with error -105 in both Preview and idle activation; this is recorded as a physical failure, not a successful acceptance. Versions 0.1.1 through 0.1.6 use the corrected installation identifier; physical re-test is pending. Version 0.1.2 adds fixed-cover placement and optional offline motion interpolation. Version 0.1.3 repairs preview media handling, adds independent artwork selection and makes the video-size limit configurable. Version 0.1.4 adds measured preparation progress, lighter 24/30 fps profiles and optional direct Steam-account import. Version 0.1.5 adds a complete media purge. Version 0.1.6 filters Steam infrastructure and adds display-only 16:9 / 16:10 crops. See STEAM_ERROR_105.md.

Test totals, archive sizes and checksum verification are recorded below; the distributed SHA256SUMS identifies the final archive. Do not infer physical compatibility from passing unit tests or a successfully created archive.

## Evidence scope

| Area | Evidence | Boundary |
| --- | --- | --- |
| Scanner | Temporary real VDF/ACF files, missing Steam, corrupted manifests, duplicate and >100 games, secondary libraries, uninstallation/rescan | Not a scan of a real SteamOS installation |
| Unified catalog | Manual/installed merges, verified mappings, preservation of preferences/manual assets/cache, process lock and corrupt recovery | Unknown SGDB-only identity cannot be merged offline without an authoritative mapping |
| SteamGridDB | Official API/spec research; mocked errors/rate limits; live valid-key name/AppID/Store URL search, thumbnails, manual addition and real animated Hero downloads on Portal 2 and Cyberpunk 2077 | Temporary key supplied by the user, accepted by the service; key/downloads/live captures removed after testing. Homonyms and HTTP 429 use deterministic mocks. |
| Fixed covers | Mocked official static portrait Grid lookup, real static-media preparation, independent artist credits, four positions with common title margins measured at 390px, portrait, 1280px, 1080p and 4K; preview, persistence and offline export | Live personal-key lookup and every returned cover preview passed locally; physical readability remains pending |
| Image previews | Live Portal 2: all 10 search results, 15 animation alternatives and 50 static cover previews decoded in the actual Manager; WebM thumbnail normalization, lazy lookup beyond eight results, alternate-source fallback, corrupt local thumbnail, failed Home/detail preview fallback | One live query/library; unavailable provider media and offline connection still use explicit placeholders |
| Smoothing | Real GIF, WebP and WebM → 30 fps VP9, measured frame rate/frame count and new intermediate frames; WebP offset/alpha/disposal composition, original preservation, corrupt derivative recovery, cache reuse and switching back; actual generated VP9 export playback | Synthetic original QA media on macOS. Valid 161 MiB processed WebM accepted; real conversion uses small original QA clips. No claim of encoding a 161 MiB file, hardware smoothness or subjective improvement on downloaded game artwork |
| Preparation | Real FFmpeg/FFprobe on original GIF, animated WebP, WebM and AV1→VP9; source byte preservation; corrupt media, storage ceiling, pause/reopen/resume/cancel/retry | Target hardware speed, GPU/memory/energy not measured |
| Files/network | HTTPS CDN/redirect restrictions, size/time limits, signatures before decoding, traversal/symlink rejection, key redaction/permissions, host/origin checks | Not an external security audit |
| Player | Real Chromium playback, actual downloaded animated WebP playback from local files, pause, navigation, transitions, missing-media skip, decoder bounds, resizing and cleanup | Does not establish Steam's bundled CEF codec behavior or activity dismissal |
| Installer | Isolated temporary Steam folder, atomic owned replacement, rollback, refusal of unowned files/symlinks, uninstall preserving neighbors | Correct files do not prove Steam discovers/executes them |
| Interface | Actual app browser screenshots, mocked provider with original test media, both languages and responsive checks | No fabricated game library shipped; captures identify QA media |
| Electron | Native macOS Electron launch, actual app:// video playback/pause, forbidden action/path rejection, renderer Node isolation, sandbox and lock release | macOS package validation is separate below; no Linux execution claim |
| Packaging | Local Linux x64 cross-package, archive/checksum and manifest inspection | Not a Linux runtime test |

Live 0.1.3 results are in `LIVE_PREVIEWS_VALIDATION.json`: original animation 29084 by Moofy and independently chosen fixed artwork 63538 by Asuka Gaming display together from an installed file export, with the Manager closed and no HTTP requests. The temporary key and downloaded original/preview files were removed; only public metadata remains. The visible product name and removed badge are checked in both browser UI and native Electron.

## Remaining acceptance work

1. Run the Linux package in SteamOS Desktop Mode and another Linux x64 graphical desktop without adding sandbox-bypass flags. Check system dependencies, shortcut, update and removal.
2. Repeat personal-key validation on the target installation, including animated Grid composition, slow/offline recovery and rate limiting. Live name/AppID/Store URL lookup and animated Heroes have passed locally. Never publish the key or downloaded media.
3. Install/select in current Steam Gaming Mode. Confirm idle entry, GIF/WebP/VP9 CEF decoding, all transitions and next-scene timing, offline playback with the manager closed, keyboard/mouse/controller wake and immediate dismissal without leaked media/processes.
4. Measure Steam Deck 1280×800 readability/touch targets, TV 1080p/4K rendering, video decoder count, RAM/GPU use, thermals and battery behavior. Test the preparation game-detection guard with the manager launched from Desktop Mode and as a Steam shortcut.
5. Complete exact corresponding-source and notice review for redistributed GPL media binaries before any public binary release. No private Lab rights are assumed.

## Deliberate limits

Windows compatibility is deferred. Steam owned-account import uses a separate optional local API key; tests use injected official-response/provider fixtures. A live import against a personal Steam account is pending. Automatic aesthetic loop/black-frame analysis is not implemented. Titles can be toggled; baked-in logos cannot be removed and separate SteamGridDB logos are not downloaded. Reduced motion removes interface transitions and still-image drift while leaving true artwork animation intact. The inactive manager uses no permanent service.

## Final executed results

- `npm test` on 0.1.0: **56 passed, 0 failed, 0 skipped**. Version 0.1.1: **62 passed, 0 failed, 0 skipped**. Version 0.1.2: **73 passed, 0 failed, 0 skipped**. Version 0.1.3: **78 passed, 0 failed, 0 skipped**. Version 0.1.4: **85 passed, 0 failed, 0 skipped**. Version 0.1.5: **89 passed, 0 failed, 0 skipped**, including owned migration/repair and actual playback under a mapped HTTPS test origin. Includes Core regressions, actual FFmpeg fixtures/conversion and real Chromium tests for animation, stable GIF/WebP pause, transitions and direct-file export.
- `npm run check`: source syntax and no-workflow checks passed. Shell installation/removal/repair/tagline scripts pass `sh -n`. The tagline patch was exercised in an isolated owned export: backup, repeatability, unchanged catalog and preserved unrelated neighbor all passed.
- `node scripts/ui-qa.cjs --capture`: passed 28 integration checks including complete media purge, optional Steam-account import, normalized/broken-preview recovery, explicit fixed-artwork selection, manual size limits, all cover positions, actual interpolation/export playback and restoration of originals with 0 uncaught browser errors; all five spaces at 1280, 800 and 390 pixels in English/French without horizontal overflow. Evidence: `screenshots/EVIDENCE.json`.
- `node scripts/electron-qa.cjs`: native macOS Electron app passed Steam-key save/removal, 24 fps/profile settings IPC, actual `app://` media playback and pause, forbidden path/action rejection, sandbox/context-isolation/Node-off checks and lock release. The native preview screenshot is `screenshots/09-electron-preview-qa.png`.
- Live personal-key integration: Portal 2, SGDB 17830, animated Hero 29084 by Moofy, WebP 1920×620, approximately 6.297 seconds; Cyberpunk 2077, SGDB 5209422, animated Hero 130287 by fewwan, WebP 3840×1240, approximately 15.033 seconds. Both prepared and played locally with zero HTTP requests after manager close. Exact metadata: LIVE_VALIDATION.json. Temporary key, downloaded media and live screenshots removed; only public metadata/evidence retained.
- `npm audit` (full and production scope): **0 reported vulnerabilities** at validation time. This is registry advisory evidence, not a full executable security audit.
- Local Linux x64 cross-package created. The manager executable is ELF x86-64; included Linux FFmpeg and FFprobe are static ELF x86-64, rather than the macOS development binaries. Archive approximately **174 MiB compressed / 443 MiB installed**. Exact current bytes and digest are in release metadata/SHA256SUMS. Archive contents exclude node_modules, credentials, local catalog, QA source media and Git data.
- GitHub Actions disabled before the first push; no workflows provided. Repository `Alyenax/SteamOS-Animated-Screensaver`, branch `codex/initial-candidate`, private prereleases through `v0.1.6-rc.1`. Actions remained disabled and no workflow runs were triggered.

No Linux process, physical SteamOS screensaver or controller wake result is inferred from these checks.


## 0.1.4 preparation and performance evidence

- `node scripts/benchmark-smoothing.cjs`: six actual full-pipeline runs (Quality/Fast/Very light × 30/24 fps), validating every result. `SMOOTHING_BENCHMARK.json` records development-host times, byte sizes, phases and intermediate updates. A synthetic 3-second 1280×720/8 fps source took 9.158 / 7.793 / 0.962 seconds at 30 fps. Quality at 24 fps took 6.125 seconds. These results are illustrative and are not target-device estimates.
- `node scripts/progress-ui-qa.cjs`: actual FFmpeg percentage observed advancing in the French Manager, with frames, speed, elapsed and estimated remaining time; real pause clears partial work, and resume in Very light/24 fps completes a valid derivative. `PROGRESS_VALIDATION.json` and `screenshots/13-live-interpolation-progress-qa.png` contain the evidence. Indeterminate validation is labeled separately.
- Final core/media/browser test suite: 85 passed. New checks cover 24 fps VP8, distinct profile caches, live state reads, persisted phase history, original preservation, cancel cleanup, Steam profile parsing, API response/privacy/error handling, key permissions/non-disclosure, installed/owned merges and offline restart.
- Native Electron additionally exercised Steam key save/removal and 24 fps/profile IPC, then actual local preview image/video playback and pause with the renderer sandbox enabled. All temporary fake-key fixtures were removed. No new personal Steam or SteamGridDB key was used in this version's validation.
- Existing enabled smoothing settings retain Quality/30 fps. Fast defaults only for settings that did not previously enable smoothing. Changing profiles/fps invalidates the derivative selection for preparation, preview and export while keeping the original available.


## 0.1.5 complete media purge evidence — 2026-10-16

- 89 unit/core/media/browser tests pass, with no failures/skips. New isolated filesystem cases cover all four cache folders, original/processed/fixed artwork/preview files, marked interpolation work, both owned Steam identifiers and unrelated neighbors. Game choices, settings and both key files survive byte-for-byte; preparation and installation can run again.
- Cancellation and an active preview/preparation are exercised. Missing confirmation is rejected. Linked cache roots/entries, unknown work folders and foreign Steam destinations block removal before cache deletion. A simulated busy-file error leaves a recoverable unprepared catalog; retry clears the remaining cache.
- Actual Manager UI: 28 integration checks, zero uncaught errors. The native confirmation's cancellation preserves cache/export; acceptance clears local media and Steam export. Navigation/reload do not recreate preview files. Explicit search restores actual image previews and preparation rebuilds the chosen fixed artwork for reinstall. Responsive EN/FR checks cover 1280/800/390 px. Captures: `screenshots/14-storage-after-purge-qa.png`, `screenshots/15-library-after-purge-qa.png`; full evidence in `screenshots/EVIDENCE.json`.
- Native Electron validates that the new purge IPC requires confirmation before any file operation, alongside normal playback, image decoding, pause and isolation checks. Actual destructive purge execution is confined to test cores with explicit temporary Steam roots; the real development-host Steam installation/data is never purged.
- SteamOS runtime acceptance remains pending. No new live personal-key or performance benchmark is claimed for this change; the earlier 0.1.4 synthetic smoothing report remains available.


## 0.1.6 component filtering and framing evidence — 2026-10-16

- 95 unit/core/media/browser tests passed, with zero failures or skips. Real temporary Steam manifests exercise Proton, Steam Linux Runtime and Steamworks redistributables; installed files are preserved. Tests cover startup migration and queued work, account import, SGDB search/manual-add guards and export exclusion. Proton Pulse, Protonwar and other similarly named real games remain visible.
- Crop validation and persistence cover general framing, per-game overrides, restart, complete media purge and unchanged prepared-media identity. Original is the default.
- Actual Chromium playback measures Original / 16:9 / 16:10 frame dimensions at five viewport sizes, including 1280×800, portrait 390×844, 1080p and 4K. Pixel captures distinguish top/bottom focal positions. Direct player settings updates, resize, pause/resume and a file:// installed export preserve the chosen ratio and position without network requests.
- Manager: 31 integration checks passed with zero uncaught errors. Global framing updates the real player without additional prepare calls; game controls save the crop, center it and disable axes with no clipping. The French game dialog fits 390 px, including wrapped fixed-artwork buttons. All five spaces are checked at 1280/800/390 px in both languages. Captures: screenshots/16-game-crop-editor-qa.png and screenshots/17-crop-editor-390-fr-qa.png.
- Native macOS Electron exercises a 16:10 per-game override of general 16:9 framing and its focal position through the actual bridge and app:// media player, alongside key handling, playback/pause, isolation and lock release. No new personal API key was used. Test media and provider results are original/injected fixtures.
- Local Linux x64 package and source archive are installation candidates. Physical SteamOS cropping, client launch, performance and controller wake remain pending; no target-device result is inferred from local rendering.


## 0.1.7 native macOS distribution

The macOS 13+ Apple Silicon app contains the same Core/Manager/Player and native source-built FFmpeg / FFprobe, with libvpx and dav1d. `scripts/macos-media-qa.cjs <app>` runs the packaged media code against original GIF, WebP, VP9 and AV1 fixtures, validates source preservation and image previews, and exercises Fast/Quality/Very light processing. It verifies arm64 architecture and system-only dynamic dependencies.

`node scripts/electron-qa.cjs --app <app> --report <report>` launches the distributed executable with an isolated temporary catalog. It checks packaged arm64 identity, forced JPEG preview generation, new 24 fps preparation through IPC, actual app:// animation playback/pause, per-game framing, renderer isolation and lock cleanup. It does not use personal keys or purge the real development-host library. Executed results are supplied in `MACOS_VALIDATION.json` with the release, alongside asset checksums.

The bundle has an ad-hoc signature verified with `codesign --verify --deep --strict`. It is not Developer ID signed/notarized. Validation on the development Mac does not establish Gatekeeper acceptance of a quarantined internet download or operation on every macOS 13+ machine. DMG/ZIP contents and signatures are checked independently of source-tree launch. SteamOS idle activation and physical device acceptance remain pending.
