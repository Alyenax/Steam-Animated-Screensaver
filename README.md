# SteamOS Animated Screensaver

**Bring Your Steam Library to Life.**

Turn your Steam games into an animated screensaver powered by SteamGridDB. Scan installed games, add any title manually, choose an artist's animation, prepare it once, and enjoy it entirely offline.

**0.1.3 is a private installation candidate.** The manager, media pipeline and player are exercised locally. Physical SteamOS/Gaming Mode and Steam Machine acceptance remain pending. See [validation evidence](docs/VALIDATION.md) before installing on your main device.

![Actual first-run manager, with no fabricated library](screenshots/01-home-onboarding.png)

The application uses its full name, **SteamOS Animated Screensaver**, throughout the interface. No GabeCubeAura, Decky Loader, account password, or permanent background service is required.

## Your library, your intermission

- Automatically scan Steam manifests, including secondary libraries, entirely offline.
- Add games by name, Steam AppID or Steam Store URL using one personal SteamGridDB key. Select the exact result when names overlap.
- Prefer actual animated Heroes, then animated Grids. Still artwork is clearly labelled and disabled by default.
- Prepare incrementally with a persistent queue, pause, resume, cancellation and retry. Keep manual artwork choices and creator credits.
- Browse a responsive English/French gallery, preview the same offline player, then install a local snapshot into Steam.
- Add a fixed game cover beside the title or in three screen corners, using matching margins and local creator credits.
- Optionally prepare a smoother 30 fps video offline, keeping original animations for an immediate return to their original rendering.
- Preserve media proportions with a subdued blurred surround, crossfade or fade to black, shuffle and game-title controls.

![Actual manager with original validation animations](screenshots/02-home-prepared-qa.png)

**Screenshot provenance:** the prepared gallery above runs the actual application with original test animations and a mocked SteamGridDB provider. Its titles explicitly identify QA animations. These screenshots are illustrative QA media, separate from the successful live personal-key API tests on Portal 2 and Cyberpunk 2077 recorded in docs/LIVE_VALIDATION.json. Downloaded game artwork was deleted after those tests. All six requested views and responsive captures are in [screenshots](screenshots/); the procedure is reproducible with `node scripts/ui-qa.cjs --capture`.

## Steam Machine error -105 on 0.1.0

The initial space-containing export identifier has been replaced with `steamos-animated-screensaver`. [Repair instructions](docs/STEAM_ERROR_105.md) include a small script that preserves existing media. Restart Steam and select the new identifier afterward. The affected device still needs to confirm the correction.

## Install the Linux x64 candidate

Download the `.tar.gz` and `SHA256SUMS` from the private release. Steam Deck/Steam Machine are the intended hardware; the binary has not yet been executed on those devices. In Desktop Mode:

```sh
sha256sum -c SHA256SUMS
tar -xzf SteamOS-Animated-Screensaver-0.1.3-linux-x64.tar.gz
cd steamos-animated-screensaver-linux-x64
./install.sh
```

Open **SteamOS Animated Screensaver** from the application launcher. Add your personal API key in Settings, rescan or add games, then choose **Prepare My Screensaver**. Preview the result and use **Install screensaver**. In Steam, select **steamos-animated-screensaver** in **Settings → Customization → Screensavers**. Restart Steam if its selector has not refreshed.

The application installs to `~/.local/opt/steamos-animated-screensaver`; it does not disable SteamOS read-only mode, use `sudo`, install global dependencies, or change Steam manifests. The package contains Electron and separate FFmpeg/FFprobe tools. It expects a Linux x64 graphical desktop with the system libraries Electron needs; see [installation](docs/INSTALLATION.md).

## Covers and optional smoothing

In **Settings → Playback**, enable **Show a still cover** and choose **Cover position**: beside the title, bottom right, top right or top left. The same controls are also in Preview. Each corner uses the title's horizontal/vertical margins. Prepare the library once to cache static portrait Grids from SteamGridDB; an existing local thumbnail is used when none is available. Cover and animation credits remain separate. In **Library → Game details → Fixed artwork → Choose / change fixed artwork**, select another still image; it is prepared immediately without replacing the animation. **Use automatic artwork** restores automatic selection.

**Smooth animations · 30 fps** is off by default. Enable it, prepare again, preview the result, then **Update / repair** to publish it to Steam. It interpolates low-frame-rate animations into a separate silent VP9 video, up to 1080p. Processing can take minutes and interpolation can cause visual artifacts; it does not repair a broken loop. Original bytes remain available. **Maximum size per 30 fps video (MB)** defaults to **0**, meaning no per-video size limit; set a positive value for your own ceiling. The total library storage setting and free disk space remain applicable. The former fixed 160 MiB output/temporary-frame limits and three-minute interpolation deadline are removed. Disable the option and update the Steam snapshot to return to original playback without downloading again. Already fluid media at approximately 30 fps or above is preserved. Optional processing failures are visible in Preparation and fall back to the original animation.

Search, library, preparation and alternative galleries normalize provider thumbnails into locally cached JPEGs, including thumbnails supplied as WebM videos. Missing/corrupt thumbnails fall back to available source media; unavailable assets show an explicit placeholder. Search results beyond the first eight load artwork on demand.

The promotional sentence above each scene title has been removed. The small `remove-screensaver-tagline.sh` also hides it in existing owned installations without preparing media again.

## Update and remove

Close the manager, download and verify the next candidate, and run its `install.sh`. Your catalog, key and prepared media are preserved. After catalog or playback changes, use **Update / repair** to republish the installed Steam snapshot.

To remove the screensaver, use **Settings → Uninstall**. To remove the manager, run `~/.local/opt/steamos-animated-screensaver/uninstall.sh`. Local media and settings remain until you explicitly erase them. See the [full uninstall and recovery guide](docs/INSTALLATION.md).

## Build and develop

Use Node 22.12 or newer and npm. The dependency lockfile is committed.

```sh
npm ci
npx install-electron
npm test
npm run check
npm start
```

`npm run dev` prints a local browser URL for UI development. `npm run package:linux` cross-packages the Linux x64 tar archive. It downloads Electron with its upstream checksums and the pinned FFmpeg distribution; the build records binary provenance and SHA-256 hashes. No GitHub Actions workflow is present, and Actions is disabled in the dedicated repository.

The application is three independent modules: [Core](docs/CONTRACTS.md), [Manager](manager/) and [Player](docs/PLAYER.md). See [architecture](docs/ARCHITECTURE.md), [storage and ranking](docs/STORAGE.md), [contribution guidance](CONTRIBUTING.md), and [third-party notices](docs/THIRD_PARTY.md).

## Current limits

No Windows compatibility is advertised. Owned-account import is deferred because the official Steam API requires an additional key and respects profile privacy. Installed tools and demos are classified conservatively by local name heuristics. A manually added SGDB-only identity is merged with a later installation once an authoritative Steam↔SGDB mapping is available; offline scanning cannot invent that mapping.

Ranking is deterministic from the metadata the API actually supplies. Decoder validity and real animation are checked during preparation. Artistic loop continuity, black endings, logo placement and aesthetic quality are not automatically scored in this candidate. Choose an alternative manually when needed. No measurements of SteamOS battery use, 4K performance, Steam CEF codecs or physical dismissal are claimed.

Original source is MIT licensed. Third-party executable licenses remain separate. Downloaded artworks belong to their respective creators and rights holders and are never bundled with releases. Public binary distribution remains gated on the recorded redistribution review and target-device acceptance.

**Not affiliated with or endorsed by Valve or SteamGridDB.**
