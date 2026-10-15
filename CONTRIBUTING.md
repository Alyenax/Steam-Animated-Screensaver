# Contributing

Use Node 22.12 or later. Run `npm ci`, `npx install-electron`, `npm test`, and `npm run check`. `npm run dev` prints a loopback URL for browser UI development. `npm start` launches the sandboxed Electron application.

Preserve the three component contracts in docs/CONTRACTS.md. Test security and lifecycle behavior at real boundaries: filesystem scanning, catalog recovery, downloads, decoder failures, installation and offline playback. Keep private fixtures, API keys and third-party artworks out of Git. Use original test media or documented test fixtures.

Do not add GitHub Actions workflows or trigger remote builds. All checks and packaging for this candidate run locally. Update docs/VALIDATION.md with the evidence actually collected; distinguish Linux execution, Steam CEF/Gaming Mode and physical hardware results.

Use a `codex/` prefix for implementation branches. Keep UI strings in the central translation dictionary and exercise both English and French at narrow and Steam Deck resolutions.
