# 0.1.8-rc.1 — Steam Animated Screensaver

The app, repository, branch and download names now use **Steam Animated Screensaver**. The interface uses functional labels in French and English. Existing catalog, API keys and prepared files migrate to the new data folder; close the previous manager before upgrading.

Library now supports select/deselect all within the current search/filter, top 100 owned games by concurrent Steam players, and top 100 by personal imported playtime. A separate Steam top-100 import adds games without asserting ownership. New discovery entries start excluded. Popularity requests show progress, support cancellation and retain previous choices on failure. Software in Valve's ranking is filtered out, so the result may contain fewer than 100 games.

Each release provides SteamOS x64, Linux x64, Windows x64 ZIP and macOS Apple Silicon DMG/ZIP. The manager installs the same player into Steam's local override directory on all platforms. Steam Big Picture/Gaming Mode activation and wake remain target-client acceptance checks; native Mac app tests do not establish native Windows/Linux compatibility.

Settings now exposes a local diagnostic JSON containing action/preparation errors, stacks, decoder details and renderer/process failures. Five rotating JSON files are retained, API keys are masked, and there is no automatic upload. Crash dumps stay local. Tests include forced renderer/main-process failures and restart recovery in an isolated app profile.

See [INSTALLATION.md](INSTALLATION.md) for paths and migration, and [VALIDATION.md](VALIDATION.md) for executed checks and their limits. GitHub Actions stays disabled. This is a private installation candidate, with no personal credentials or downloaded game artwork included.
