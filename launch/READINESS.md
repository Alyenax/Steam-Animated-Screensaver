# Public 1.0.0 preparation

This is a launch kit, not a published 1.0.0. The app/package version stays at 0.1.9 until the release is built. The repository remains private. No Reddit post has been sent.

## Prepared material

- Root README: functional overview, real app screenshots, setup and platform testing limits.
- Root changelog: short first-public-release entry; earlier history lives in `docs/DEVELOPMENT_CHANGELOG.md`.
- Reddit drafts: [English](REDDIT_EN.md) and [French](REDDIT_FR.md). The drafts assume public downloads exist; post them only after launch.
- Video: local `dist/public-launch-v2/Steam-Animated-Screensaver-demo-v2.mp4` (73 seconds, 1080p60, quiet original music), plus a silent version. All ten requested games appear, with original/16:9 framing, real ten-game batch preparation marked 8× speed, alternatives and processing settings. Upload the MP4 directly to Reddit after launch.
- Visuals: [credits and capture scope](../screenshots/public/CREDITS.md). Screenshots are from the actual 0.1.9 interface, without relabeling its version.

## Before public binary distribution

- Complete exact corresponding-source/build-material review for the Linux GPL media tools and the Windows LGPL media tools. The existing notices explicitly leave this open; see [THIRD_PARTY.md](../docs/THIRD_PARTY.md). Preserve the full component notices and sources required by their licenses.
- Review screenshot/video artwork credits and distribution scope. Captures illustrate the app; third-party artwork is not MIT licensed or included as reusable source media.
- Run a final secret/history and package-content audit. No personal keys, account catalogs, raw game artwork or private unrelated project code may enter the public distribution.
- Bump the app/package/UI version together to 1.0.0; build **all four platforms**, including both Mac DMG and ZIP. Run the existing package/native Mac/archives/lifecycle release gates and verify downloaded assets against local checksums.
- Retain clear known limitations: Windows/Linux native Steam acceptance pending, smoothing quality varies, Mac is not notarized, Windows unsigned. Signing status should be disclosed; paid signing credentials are not presumed.
- Remove the README preparation notice and date the changelog only when the release actually exists. Publish the source archive, checksums and validation reports with the platform assets.
- Making the repository public, publishing 1.0.0 and posting to Reddit are subsequent publication actions, outside this preparation step.

Capture and final MP4 verification: [VALIDATION.json](VALIDATION.json). Both the UI run and full video decode passed; this is presentation validation, not new platform runtime acceptance.

## Tester focus

On every platform: launch, search previews, prepare/change animation, still-artwork choice, framing, install/update, idle activation in Steam, offline playback and controller/keyboard/mouse dismissal. For Linux and Windows, start with a fresh standard installation and record dependencies or permission problems. Longer playback sessions should check CPU/GPU/memory use and process cleanup.

The current detailed report documents automated Mac execution and package inspection separately. SteamOS hands-on feedback comes from the maintainer; this launch capture uses the packaged Mac app and native window recording. Mac Steam selection was observed separately; the user confirmed custom playback in Preview. Automatic Mac activation is now observed using the internal Steam timer workaround; physical keyboard interruption was subsequently confirmed by the maintainer. Controller/mouse dismissal has not been separately accepted. The Manager still lacks a consumer-facing timer control. It is not Gamescope or Windows Steam footage.

## Steam context

Valve's [October 13, 2026 stable client notes](https://www.steamdeck.com/en/news?pubDate=20261013) confirm custom screensavers and the Steam `config/uioverrides/screensavers` directory. This is a **Steam client** feature, not a separate SteamOS-only OS update. Recheck the target subreddit's current self-promotion rules and flair before posting; no rules or acceptance are assumed here.
