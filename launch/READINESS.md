# Public release 1.0.0

Steam Animated Screensaver is published by [Alyenax](https://github.com/Alyenax). The public release contains the SteamOS, Linux and Windows x64 packages, the macOS Apple Silicon DMG and ZIP, source code, checksums and validation reports. Earlier private development releases are retained as unpublished drafts.

## Presentation

The README opens with a looping GIF. The general 89-second video shows ten games, original and 16:9 framing, batch preparation, animation choices, processing controls, the five-minute delay setting and actual automatic playback inside Steam on macOS. Preparation is explicitly accelerated 8×; artwork playback is real time.

The 79-second SteamOS overview omits the native Mac Steam ending and states that the app footage was captured on macOS. It is not a recording of SteamOS Gaming Mode. Earlier library and artwork captures show version 0.1.9; the delay controls show 0.1.11. The release does not relabel that footage as a new native run.

Both videos use [Song Of The Forge by Scott Buckley](MUSIC.md). Keep its CC BY 4.0 attribution with uploads. [Artwork credits and capture scope](../screenshots/public/CREDITS.md).

The static showcase archive contains both videos, the illustrated README, changelog and Reddit drafts. A local review is available through `node scripts/showcase-preview.cjs`; `--export` prepares the standalone site. GitHub Actions and remote builds remain disabled.

## Release checks

- Audit reachable Git history and release contents for credentials and private data.
- Use Alyenax as the project author and publisher. Preserve required third-party credits and notices.
- Build all four platforms from the same current app, UI and documentation version.
- Ship exact media source archives, notices and rebuild recipes in every platform package. The public Linux and Windows tools replace the previous upstream candidates.
- Run unit, browser, packaged Mac, native media, lifecycle and archive checks. Keep inspection results separate from target-platform runtime testing.
- Download the published artifacts and verify them against the release checksums.

## Testing still needed

Windows and Linux need more hands-on testing inside Steam. Controller and mouse dismissal, long playback sessions, memory, CPU, GPU and battery behavior need further target-machine reports. Mac keyboard dismissal was confirmed by the maintainer. Source animation quality varies, and processing at 24 or 30 fps can be slow.

The Mac app is ad-hoc signed and not notarized. Windows is unsigned. These limits are stated in the installation guide and release notes.

## Reddit drafts

[General English post](REDDIT_EN.md) and [SteamOS English post](REDDIT_STEAMOS_EN.md) are prepared but have not been posted. French drafts are retained as references. Check each community's rules and flair before posting. Publication of this GitHub release does not post to Reddit.
