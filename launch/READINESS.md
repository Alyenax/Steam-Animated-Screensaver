# Public 1.0.0 preparation

This is a launch kit, not a published 1.0.0. The app/package version stays at 0.1.9 until the release is built. The repository remains private. No Reddit post has been sent.

## Prepared material

- Root README: functional overview, real app screenshots, setup and platform testing limits.
- Root changelog: short first-public-release entry; earlier history lives in `docs/DEVELOPMENT_CHANGELOG.md`.
- Reddit drafts: [English](REDDIT_EN.md) and [French](REDDIT_FR.md). The drafts assume public downloads exist; post them only after launch.
- Video: local `dist/public-launch/Steam-Animated-Screensaver-demo.mp4`, with captions and a clean version (66 seconds, 1080p). The opening compares the same animation at its original size and cropped to 16:9, before showing settings. Upload the MP4 directly to Reddit when publishing; do not post the private release URL as a public download.
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

The current detailed report documents automated Mac execution and package inspection separately. SteamOS hands-on feedback comes from the maintainer; this launch capture itself is a Mac browser run of the actual UI/player, not a recording inside Gamescope or Windows Steam.

## Steam context

Valve's [October 13, 2026 stable client notes](https://www.steamdeck.com/en/news?pubDate=20261013) confirm custom screensavers and the Steam `config/uioverrides/screensavers` directory. This is a **Steam client** feature, not a separate SteamOS-only OS update. Recheck the target subreddit's current self-promotion rules and flair before posting; no rules or acceptance are assumed here.
