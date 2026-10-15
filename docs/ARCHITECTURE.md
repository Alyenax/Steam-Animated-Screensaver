# Architecture and research

This project is a clean-room implementation. No private GabeCubeAura code, media, API key or dependency was copied. The reference repository's release list was inspected read-only on 2026-10-15: its newest published candidate was `v1.4.1-lab.124`. It has no declared repository license; its implementation was therefore not imported.

## Why Electron

The manager ships a pinned Chromium renderer and Node backend. Tauri 2 would reduce download size, but uses Linux's system WebKitGTK: availability, version, video codecs and installation on an immutable SteamOS image would need a separate dependency solution. Electron trades a larger package for a predictable renderer and a package containing its preparation executables. This is an architectural choice, not proof that the resulting binary has run on a Steam Deck. Linux runtime acceptance remains pending.

The renderer has no Node access. Context isolation and Chromium sandboxing are enabled. A narrow, sender-validated IPC method calls the independently testable core. A local `app://cinema` protocol serves only manager/player assets and media filenames contained by real paths. All preparation happens in the backend. There is no listening HTTP service in the packaged application. The loopback HTTP server is a development/test tool with strict origin and Host checks.

The dependency lockfile pins development tools. Player and manager use native JavaScript modules and CSS; they require no frontend bundler. FFmpeg and FFprobe are separate bounded child processes, not linked into the JavaScript application. The packaged player has no dependency on Electron, Node, FFmpeg, the manager, a daemon, or an API key.

## Runtime evidence

Valve's stable [Steam Client Update, October 13, 2026](https://www.steamdeck.com/en/news?pubDate=20260808) explicitly documents `~/.steam/root/config/uioverrides/screensavers/` and points to the built-in bouncing-logo example. The public [tabs-screensavers repository](https://github.com/Acerocks22/tabs-screensavers) demonstrates a named directory with `index.html`, local scripts and images. This project recreates that structure independently. No local Steam installation containing the actual built-in screensaver was available during initial research.

These sources establish the installation layout. Only target-device testing can establish this player's behavior in Steam's CEF runtime, especially codec playback, idle entry and activity dismissal. See PLAYER.md and VALIDATION.md.

## SteamGridDB and account scope

The [official SteamGridDB v2 API](https://www.steamgriddb.com/api/v2) is the sole artwork/search backend. Steam AppIDs and SteamGridDB game IDs are distinct. Numeric/Store URL searches resolve by the external Steam mapping; name searches return user-selectable matches. A manually added game is never represented as owned by the Steam account.

Optional owned-library import is deferred. Valve's [IPlayerService GetOwnedGames documentation](https://partner.steamgames.com/doc/webapi/IPlayerService?language=english) requires a Steam Web API key and respects game-detail visibility. Requiring an additional key would complicate the primary experience. The installed-library scanner and manual SteamGridDB search need no Steam account credentials.

## Lifecycle

The manager owns one core and one sequential preparation worker. Catalog and queue mutations are persisted atomically. Closing the manager pauses recoverably; finished files remain reusable. The player reads an exported local catalog. The installed snapshot continues working if the manager is removed. Editing the manager's catalog does not silently modify Steam's active installation; Install/Repair republishes it.

See CONTRACTS.md for versioned component interfaces, STORAGE.md for local paths, and PLAYER.md for media and playback behavior.
