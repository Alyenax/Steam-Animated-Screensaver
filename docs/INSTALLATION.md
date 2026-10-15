# Installation, updates and recovery

## Candidate requirements

- Linux x86_64, graphical Desktop Mode, current Steam client supporting custom screensavers.
- User-space writable home directory, working Chromium sandbox/user namespaces, and the GTK/NSS/GBM/audio libraries expected by Electron. The package bundles Chromium but does not claim to bundle an entire Linux userspace.
- Internet and one personal SteamGridDB key for discovery/preparation. An optional separate Steam Web API key imports owned games, including non-installed ones, directly without a hosted service. Playback needs neither.
- Space for the application, cached source media, thumbnails, and an installed playback copy. Cache defaults to a configurable 10 GB maximum; Steam's installed snapshot occupies additional space.

The installer does not install system libraries, bypass the sandbox, request root, modify the immutable system partition, or auto-start a daemon. If startup fails, run the executable from a terminal and preserve the diagnostic. Do not add `--no-sandbox` as a routine workaround. Actual SteamOS and Linux runtime testing are still required.

## Installing

Verify `SHA256SUMS` in the download directory. Extract the archive, enter its directory and run `./install.sh`. This installs an owned copy at `~/.local/opt/steamos-animated-screensaver` and writes one desktop entry at `~/.local/share/applications/steamos-animated-screensaver.desktop`.

The script refuses unowned destination folders and symbolic-link targets. Updates stage a complete copy before replacing the old application. Close the manager before updating. Existing catalog/media are outside the application folder.

For a portable launch without installing a shortcut, run `./steamos-animated-screensaver` from the extracted package.

## Preparing and selecting in Steam

1. Open Settings, follow **Get API key**, and save your personal SteamGridDB key. Validate the connection.
2. Rescan installed games or **Add game** by title, Steam AppID, or Store URL. Name matches require an explicit selection. Manually adding a game does not install it or assert ownership.
3. Include games, optionally choose alternative artwork, and prepare. Animated Heroes take priority. Static fallback is opt-in and visibly identified.
4. Preview. The same player is used by the Steam export.
5. Install from Preparation/Settings. In Steam choose **Settings → Customization → Screensavers → steamos-animated-screensaver**. Restart Steam if discovery needs refreshing.

The target is the first detected Steam installation's `config/uioverrides/screensavers/steamos-animated-screensaver/`. Secondary *libraries* contribute games; they are not separate screen-saver install targets. The default root search handles native Steam symlinks and the documented Flatpak user directory, but Flatpak sandbox/CEF loading is untested. A `STEAM_ROOT` environment variable can prioritize a nonstandard Steam root when launching the manager.

No selector settings are patched and no Steam client restart is forced. Existing screensavers and unrelated Steam files are left alone. Selecting the screensaver, idle entry, controller wake and dismissal must be validated on the device.

## Updates and repairs

Download the next archive and its checksum file. Close the manager and run the new archive's `install.sh`. Catalog schema v1 and cached files stay in the data directory. **Repair Library** verifies local media and marks missing/invalid files for preparation; **Update / repair** in Steam Integration republishes the ready included catalog and settings into Steam.

The installed player is a snapshot. Changes in the manager take effect in Preview immediately and in Steam after an explicit update. The snapshot continues offline when the manager is closed or uninstalled.

If preparation is interrupted, reopen the manager and Resume. The current unfinished download restarts; completed scenes are reused. Media is committed only after validation. Cancel preserves finished scenes. Retry failed repeats failures, not every ready item.

If a catalog is malformed it is preserved as a `.corrupt-<timestamp>` file and a recovery message is shown. Back up the data directory before restoring any catalog manually. An exclusive local manager lock avoids simultaneous catalog writers; a stale lock whose process is gone is recovered.

## Purge media while retaining your library

Use **Settings → Local storage → Purge all media** and confirm. This stops the current preparation, clears all managed local media (originals, processed variants, fixed artwork, thumbnails/previews and unfinished work) and removes this app's installed Steam snapshot. Game identities, inclusion/artwork choices, settings and API keys are retained. Cancellation leaves everything unchanged.

After purge, automatic image previews remain paused even after restart. An explicit artwork search/gallery or preparation enables downloads again. Choose **Prepare**, then **Install screensaver** to recreate the Steam export. A separate **Remove unused media** button performs a smaller cleanup without resetting prepared scenes.

## Removal

Use Manager Settings → Steam Integration → **Uninstall** to remove only the owned screensaver directory. This preserves other custom screensavers, Steam manifests, the manager and its cache.

Run the installed `uninstall.sh` to remove the manager and its desktop entry. It preserves the catalog, personal key and installed Steam snapshot. Remove the Steam snapshot first if you do not want it to remain usable.

To erase all application data, close the manager, back up anything needed and explicitly remove `~/.config/steamos-animated-screensaver`. This deletes the local personal key, catalog and prepared media. If you set `XDG_CONFIG_HOME` or use a custom data directory, use that actual path instead. Never remove a Steam library to uninstall this application.

## Target-device acceptance

See VALIDATION.md, PLAYER.md and STEAM_ERROR_105.md for the 0.1.0 identifier repair. No macOS release is provided; macOS is the development and software-validation host. Windows support is not implemented.
