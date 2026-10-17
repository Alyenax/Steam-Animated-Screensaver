# App updates

Steam Animated Screensaver 1.2.0 adds internal updates from the official public GitHub repository. Users of 1.1.1 or earlier must install 1.2.0 manually once.

## Using updates

Open **Settings → App updates**. Check for an available stable version, read the release notes, then choose **Download update**. Downloading shows measured bytes and percentage and can be cancelled. After verification, choose **Restart and install** and confirm. The app closes, the helper replaces it and the new app restarts. Your library, downloaded artwork, keys and settings are kept. A catalog snapshot is retained for rollback.

Automatic checks are enabled by default, at most once per day while the app is running. They can be disabled. Nothing is downloaded or installed automatically. The updater does not run when the app is closed. No server, GitHub account or token is required. GitHub errors and rate limits are displayed and retried with a delay.

The app and Steam's installed screensaver are separate copies. After an app update, use **Update in Steam** when prompted. Valid prepared media is reused. Steam playback continues to work offline with the app closed.

## Supported installations

- SteamOS and Linux x64: the installed user application or a writable extracted application folder. The helper uses the same filesystem for staging and replacement. No sudo or SteamOS system modification is required.
- Windows x64: a writable extracted portable folder. The PowerShell helper waits for the old process, retries transient file locks and restarts the app. A device policy that prevents local helper execution may require manual installation.
- macOS arm64: an installed writable app bundle, normally in Applications. A copy running inside the read-only DMG cannot replace itself. DMG mounting is read-only; framework links and bundle metadata are preserved. No quarantine or global security setting is removed.

Windows and Linux app folders have a packaged boundary inventory. If extra files appear in that folder, automatic replacement is disabled to preserve them. Shared user folders such as Desktop and Downloads are never replacement targets.

Unsupported or read-only locations keep the **Open GitHub release** option for manual installation. OS prompts and local security policies still apply. The release signature does not replace Apple or Windows publisher signing.

## Verification

The updater accepts stable semantic versions newer than the running application. It uses only the fixed official repository and approved HTTPS GitHub download redirects. The downloaded `update.json` must verify using the embedded Ed25519 public key. Its exact payload binds the product, version, minimum updater format and the four supported platform packages with filenames, sizes and SHA-256 hashes. GitHub asset metadata must agree.

Archives are downloaded to private temporary files in a stream. Size and SHA-256 are checked before marking the download ready, and checked again immediately before installation. Extraction rejects traversal, duplicated paths, Windows reserved aliases, encryption, unsupported file types and external symlinks. Expanded bytes and file counts are bounded. Mac signatures and app identities are checked after preparation. App staging uses the installation filesystem; user media is never extracted over or deleted.

## Recovery

Before replacement the app stops work, saves its catalog and exits. Helpers run independently from `dataDir/updates/transactions/<nonce>/`. The transaction includes a catalog snapshot, fixed helper, result journal and one-time health handshake. The new renderer must load, access its IPC bridge and read its library before acknowledging startup.

A failed startup restores the old app and catalog and relaunches the old app. Credentials and media are kept in their original data directories. The previous app backup is a sibling named `.<app folder>.previous-<nonce>`. Failed app copies, if any, are retained as `.sas-failed-<nonce>`. These are local recovery artifacts, not Steam screensavers.

Replacement uses journaled renames. It does not claim a single atomic swap on every filesystem. If the OS kills the helper or power is lost in the narrow interval between renames, the saved transaction and previous app remain available. When the active path is missing, the saved helper can restore it from its expected backup after the interrupted process exits. Do not remove backups while diagnosing an interrupted update. Native Windows and Linux recovery still needs target-device acceptance.

## Publishing

Build and test all four platforms locally. No GitHub Actions workflow is used. `npm run release:bundle` signs `update.json` and prepares exactly eight upload files: four platform packages, update descriptor, validation ZIP, original demo and SHA256SUMS. GitHub provides two source archives, for ten displayed assets.

The private Ed25519 release key is a local file in the ignored `.release-secrets/update-signing-key.pem`, or an explicitly supplied `SAS_UPDATE_SIGNING_KEY` file. It must match `core/update-key.cjs`. Keep a secure backup of that private key; it is never uploaded, logged or packaged. Signing refuses a missing, linked or mismatched private key. On POSIX hosts it also requires owner-only permissions. If the key is lost, existing clients need a manually installed trust transition rather than silently trusting a replacement key.

Publish from a draft only after every app package and descriptor has been uploaded and downloaded files match local hashes. Retain the changelog platform installation table. The explicit source ZIP is no longer uploaded separately because GitHub already supplies source archives for the release tag.

Run the unit/integration suite, `scripts/updater-ui-qa.cjs`, `scripts/macos-update-qa.cjs`, the ordinary app/media/lifecycle checks and archive inspection. The Mac update test uses temporary copies and re-signed 1.2.1 QA variants for healthy and failed startup; it is not a public 1.2.1 release. Windows/Linux archive inspection and simulated/helper checks do not substitute for running the update on those systems.
