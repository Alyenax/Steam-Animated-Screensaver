# Contributing

Use Node 22.12 or later. Run `npm ci`, `npm test`, and `npm run check`. `npm run dev` prints a loopback URL for browser UI development. `npm start` launches the sandboxed Electron application.

Preserve the component contracts in docs/CONTRACTS.md. Test real boundaries: filesystem scanning, catalog recovery, provider errors, downloads, decoder failures, cancellation, installation and offline playback. Keep API keys and standalone third-party artwork out of Git; use original labelled media for tests. The launch presentation uses app screenshot excerpts, credited separately in screenshots/public/CREDITS.md; those captures do not relicense the depicted artwork or permit bundling its raw media. User-facing descriptions must explain functionality without promotional slogans. Exercise English/French, keyboard controls and narrow layouts.

Use the `codex/` prefix for implementation branches. Product name: **Steam Animated Screensaver**; slug: `steam-animated-screensaver`. Historical identifiers are permitted only for safe migration.

## Release requirement

Every published version must provide **SteamOS x64, Linux x64, Windows x64 and macOS Apple Silicon** downloads together. macOS includes both DMG and ZIP. SteamOS and Linux use the same Linux x64 application. Never silently publish only the development host's package.

Run `package:mac`, `package:windows`, `package:linux` and `package:steamos`, then execute the packaged Mac, media, archive and lifecycle QA scripts listed in docs/VALIDATION.md. Run `npm run release:check` against the final artifacts; it rejects missing packages, stale source/docs, bad archive integrity and invalid Windows x64 headers. Publish the source archive, checksums and validation reports with the private prerelease. Download the published assets and byte-compare them against the local originals.

Keep native execution results separate from cross-packaging and file inspection. Actual Steam Big Picture/Gaming Mode activation, wake, decoder performance and long-duration stability require target-client evidence. Do not describe an unexecuted platform as native-tested.

Do not add GitHub Actions workflows, enable Actions or trigger remote builds. Checks and packaging run locally. Update docs/VALIDATION.md and the machine-readable stability report with the evidence actually collected. Preserve unrelated local data and use temporary profiles/Steam roots for destructive or crash tests.
