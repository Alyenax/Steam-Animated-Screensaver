# Architecture and research

This project is a clean-room implementation. No private GabeCubeAura code, media, API key or dependency was copied. The reference repository's release list was inspected read-only on 2026-10-15: its newest published candidate was `v1.4.1-lab.124`. It has no declared repository license; its implementation was therefore not imported.

## Why Electron

The manager ships a pinned Chromium renderer and Node backend. Tauri 2 would reduce download size, but uses Linux's system WebKitGTK: availability, version, video codecs and installation on an immutable SteamOS image would need a separate dependency solution. Electron trades a larger package for a predictable renderer and a package containing its preparation executables. This is an architectural choice, not proof that the resulting binary has run on a Steam Deck. Linux runtime acceptance remains pending.

The renderer has no Node access. Context isolation and Chromium sandboxing are enabled. A narrow, sender-validated IPC method calls the independently testable core. A local `app://screensaver` protocol serves only manager/player assets and media filenames contained by real paths. All preparation happens in the backend. There is no listening HTTP service in the packaged application. The loopback HTTP server is a development/test tool with strict origin and Host checks.

The dependency lockfile pins development tools. Player and manager use native JavaScript modules and CSS; they require no frontend bundler. FFmpeg and FFprobe are separate bounded child processes, not linked into the JavaScript application. The packaged player has no dependency on Electron, Node, FFmpeg, the manager, a daemon, or an API key.

## Runtime evidence

Valve's stable [Steam Client Update, October 13, 2026](https://www.steamdeck.com/en/news?pubDate=20260808) explicitly documents `~/.steam/root/config/uioverrides/screensavers/` and points to the built-in bouncing-logo example. The public [tabs-screensavers repository](https://github.com/Acerocks22/tabs-screensavers) demonstrates a named directory with `index.html`, local scripts and images. This project recreates that structure independently. On 2026-10-16 the Mac client’s built-in example was inspected read-only at `~/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamui/screensavers/bouncinglogo/index.html`; no Valve code or artwork was copied. The custom export remains rooted in the client’s `config/uioverrides/screensavers/`, not inside that app bundle.

These sources establish the installation layout. A subsequent 0.1.0 Steam Machine report exposed a virtual-host assumption: Steam loads the returned screensaver path as an HTTPS hostname. The 0.1.1 correction uses a DNS-safe installation identifier and adds a mapped-HTTPS playback test; see STEAM_ERROR_105.md. Only target-device testing can establish this player's behavior in Steam's CEF runtime, especially codec playback, idle entry and activity dismissal. See PLAYER.md and VALIDATION.md.

## SteamGridDB and account scope

The [official SteamGridDB v2 API](https://www.steamgriddb.com/api/v2) is the sole artwork/search backend. Steam AppIDs and SteamGridDB game IDs are distinct. Numeric/Store URL searches resolve by the external Steam mapping; name searches return user-selectable matches. A manually added game is never represented as owned by the Steam account.

Optional owned-library import calls Valve's [IPlayerService GetOwnedGames](https://partner.steamgames.com/doc/webapi/IPlayerService#GetOwnedGames) directly from the backend with the user's personal Steam Web API key. Vanity profile URLs resolve through [ISteamUser ResolveVanityURL](https://partner.steamgames.com/doc/webapi/ISteamUser#ResolveVanityURL). HTTPS endpoint and redirects are restricted; requests time out and responses are size-bounded. Privacy errors do not erase an existing import. This uses no login cookies, OpenID flow, developer key in the package or hosted service. The installed scanner/manual addition still need no Steam account credentials. Keys remain in separate local files, not state/catalog/export. New account imports default to excluded.

## Lifecycle

The manager owns one core and one sequential preparation worker. Catalog and queue mutations are persisted atomically. Closing the manager pauses recoverably; finished files remain reusable. The player reads an exported local catalog. The installed snapshot continues working if the manager is removed. Editing the manager's catalog does not silently modify Steam's active installation; Install/Repair republishes it.

See CONTRACTS.md for versioned component interfaces, STORAGE.md for local paths, and PLAYER.md for media and playback behavior.

## Smoothing and telemetry

The optional derivative uses explicit fps/profile configuration and source SHA-256 identity. Fast uses 720p motion interpolation and realtime VP8; Quality retains 1080p detailed motion interpolation and VP9; Very light uses FFmpeg frame blending (possible ghosting) and VP8. No upscaling. [FFmpeg minterpolate](https://ffmpeg.org/ffmpeg-filters.html#minterpolate) documents the different interpolation methods. Codec, fps and profile are part of cache validity; exported and previewed derivatives must match current settings. Old enabled settings migrate to Quality/30 fps.

[FFmpeg `-progress`](https://ffmpeg.org/ffmpeg.html#Generic-options) supplies bounded, incrementally parsed key/value records through stdout every 0.5 s. Frame count/output timestamp supplies the actual current-step percentage. No cumulative output is retained for long encodes. Non-quantifiable source/output validation remains indeterminate. WebP composition reports completed frames directly. The core serves live in-memory telemetry without putting state reads behind preparation, records phase changes and 10-percent milestones in a 250-entry journal, and saves it at queue checkpoints. The Manager polls at 800 ms, displays the current phase separately from games completed, and bounds its displayed history to 100 events. No percentage advances merely because time elapsed.
