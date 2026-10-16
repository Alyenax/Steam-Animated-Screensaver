# Validation — Steam Animated Screensaver 0.1.10

Validation host: macOS arm64. This report distinguishes native execution, automated software tests and cross-platform package inspection. Windows, Linux and SteamOS packages are built here; native execution and actual Steam CEF idle/wake acceptance on those targets remain pending. Passing tests does not establish universal stability.

The 0.1.10 update adds guarded Steam inactivity configuration after inspection of current first-party Windows/macOS/Linux client packages. Its dedicated unit tests exercise backups, unchanged unrelated values, closed/running Steam, malformed/ambiguous files, links and concurrent changes. The real UI test exercises Apply, blocked Apply, refresh, persistence, EN/FR and responsive widths. Full suite: 127 passing tests. Native Mac packaged-app results are recorded with the private release; Windows/Linux/SteamOS native Steam acceptance remains pending. See [the client investigation](STEAM_IDLE_INVESTIGATION.md).

## Executed results

- 116 unit/integration tests passed, zero failures or skipped tests.
- 31 main browser end-to-end checks and 6 selection checks passed, with no unexpected browser errors.
- 18 packaged native Mac checks, eight native media checks and four native lifecycle/recovery checks passed.
- Public Valve smoke from 0.1.8 returned 93 games after filtering 100 upstream entries; the provider is unchanged and that evidence remains historical.
- A 5,000-game catalog passed bulk inclusion, both exact top-100 selections, save and restart.

Machine-readable results: [STABILITY_VALIDATION.json](STABILITY_VALIDATION.json).

The 0.1.9 regression also delays the installed player’s catalog and first GIF, observes rendered frames in EN/FR and checks that startup shows no presentation page or introductory fade. A dedicated animation-picker end-to-end flow covers immediate button visibility, desktop/handheld layouts, working previews, provider error/empty/retry, choosing/preparing a different animation and preserving fixed artwork/crop in the Steam export. Evidence: [ANIMATION_PICKER_VALIDATION.json](ANIMATION_PICKER_VALIDATION.json).

## Test layers

| Layer                 | Executed checks                                                                                                                                                                                 | Evidence                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Unit and component    | Catalog validation, manifests/VDF, component exclusion, matching/ranking, URL restrictions, storage budgets, crop/profile math, safe migration and export ownership                             | `npm test`                                              |
| Integration           | Real FFmpeg decoding/transcoding, WebP composition, corrupted media/thumbnail recovery, queue persistence, pause/cancel/resume, export snapshots, purge preflight and preservation              | `npm test`, `scripts/progress-ui-qa.cjs`                |
| Browser end to end    | Search/artwork previews, fixed artwork, preparation, player/cover positions, crop editor, purge/rebuild, offline file and mapped HTTPS playback, EN/FR responsive views                         | `screenshots/EVIDENCE.json`, `PROGRESS_VALIDATION.json` |
| Selection end to end  | 125-game owned catalog, filtered select/deselect, both exact 100-game rankings, progress, cancellation, global import/deduplication, all five views at 1280/800/390 px                          | `SELECTION_VALIDATION.json`                             |
| Public provider smoke | Actual unkeyed Valve charts, store metadata and concurrent-player APIs; software filtering and three individual game counts                                                                     | `POPULARITY_LIVE_VALIDATION.json`                       |
| Native macOS app      | Packaged arm64 app, actual app:// preview generation/video playback, 24 fps derivative, settings/IPC isolation, renderer JS/rejection/console errors and forced renderer termination            | Release `MACOS_ELECTRON_VALIDATION.json`                |
| Native media tools    | Bundled FFmpeg/FFprobe architecture and codecs, GIF/WebP/VP9/AV1, measured 24/30 fps processing profiles                                                                                        | Release `MACOS_MEDIA_VALIDATION.json`                   |
| Lifecycle and faults  | Repeated native launches with concurrent queued changes, clean shutdown and locks, actual old-name startup migration, fatal main-process exception, durable log and restart/stale-lock recovery | Release `LIFECYCLE_VALIDATION.json`                     |
| Logging faults        | Immediate process exit, nested stack/stderr retention, credential redaction, bounded JSON rotation, simulated disk-full failure/recovery and linked-path rejection                              | `tests/diagnostics.test.cjs`                            |
| Distribution          | All four current platform artifacts; ZIP/tar/DMG integrity; package/source byte checks; Windows x64 PE headers; no catalog/key files in shipped app                                             | Release `PACKAGE_VALIDATION.json`, `SHA256SUMS`         |

The release pipeline is local and explicit. `npm run release:check` refuses a missing/stale platform package. GitHub Actions remains disabled. Downloaded release assets are byte-compared with the local published files before delivery.

## Fault-injection boundaries

All destructive, crash and recovery tests use isolated temporary catalogs, profiles and Steam roots. They do not purge the user's real Steam installation or read personal keys. Most artwork UI tests use original labelled media and deterministic provider responses; they are not live account tests. Public Steam ranking calls are tested live without credentials. Earlier authenticated artwork tests are separately recorded in `LIVE_VALIDATION.json` and `LIVE_PREVIEWS_VALIDATION.json`; those temporary keys/media were deleted and were not reused for this release.

The crash tests deliberately terminate a test renderer or throw in a test main process, then assert valid JSON, crash metadata and recovery. Native crash dumps are local-only. A native OS kill/power loss cannot always supply a final stack; the session's missing clean exit is detected on restart. This is a short lifecycle/fault regression, not a multi-day resource soak.

## Steam paths and installation evidence

Native platform root detection is unit-tested for Linux/Flatpak, macOS and Windows registry/environment paths. Generic installer tests exercise atomic update/rollback, legacy markers, dual installer locks, uninstall/purge and preservation of other screensavers. Windows joining/case rules are tested with `path.win32`; those fixtures are not a Windows runtime claim.

The actual local Mac Steam root and its bundled `bouncinglogo/index.html` were inspected read-only. Export remains `<Steam root>/config/uioverrides/screensavers/steam-animated-screensaver/`. The player is tested under a mapped `https://uioverride-steam-animated-screensaver.steamscreensavers.host/` origin and directly from files, with no external requests after preparation. Actual Big Picture/Gaming Mode activation, codec behavior, controller wake and the reported Steam Machine error -105 must still be confirmed in the target client.

## Remaining native acceptance

- Launch the Windows portable ZIP on Windows 10/11 x64 and the Linux packages on a graphical Linux x64 desktop/SteamOS without sandbox bypasses. Confirm dependencies, process cleanup, updates and local permissions.
- On each platform, select the installed player in Steam Big Picture/Gaming Mode; verify timeout activation, offline playback, transition timing, keyboard/mouse/controller dismissal and no leaked decoders.
- Measure long-duration memory/GPU/CPU/thermals at Steam Deck, 1080p and 4K resolutions. No performance/battery claim is made from headless or macOS tests.
- Validate an actual personal owned-library import and privacy/rate-limit scenarios on the user's account. Provider fixtures cover behavior without representing a live authenticated import.
- Complete platform-specific signing/notarization and exact redistribution-source review before a public binary release. Current releases remain private installation candidates.

## Reproduce

```sh
npm ci
npm run check
npm test
node scripts/ui-qa.cjs --capture
node scripts/selection-ui-qa.cjs --capture
node scripts/animation-picker-qa.cjs --capture
node scripts/progress-ui-qa.cjs
npm run package:mac
npm run package:windows
npm run package:linux
npm run package:steamos
node scripts/electron-qa.cjs --app "dist/Steam Animated Screensaver-darwin-arm64/Steam Animated Screensaver.app" --report dist/MACOS_ELECTRON_VALIDATION.json
node scripts/macos-media-qa.cjs "dist/Steam Animated Screensaver-darwin-arm64/Steam Animated Screensaver.app"
node scripts/lifecycle-qa.cjs --app "dist/Steam Animated Screensaver-darwin-arm64/Steam Animated Screensaver.app"
npm run release:check
```

Building macOS requires a Mac. The initial media-tool rebuild additionally requires Xcode Command Line Tools and the pinned build prerequisites documented in `scripts/build-media-macos.cjs`; verified caches avoid rebuilding unchanged sources. Packaging Windows from this Mac uses the pinned upstream ZIP and PE resource tooling. The Mac package has an ad-hoc signature, without Apple notarization. Windows is unsigned.
