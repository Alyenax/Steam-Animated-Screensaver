# Installation, updates and recovery

Steam Animated Screensaver prepares local artwork and installs a standalone HTML player into **Steam Big Picture / Gaming Mode**. It is not an operating-system screensaver extension. No hosted server is required.

## Packages

| Platform | Package                    | Requirements                                                         |
| -------- | -------------------------- | -------------------------------------------------------------------- |
| SteamOS  | `*-steamos-x64.tar.gz`     | Desktop Mode for the manager; Linux x64 graphical session            |
| Linux    | `*-linux-x64.tar.gz`       | Linux x64 with Electron's GTK/NSS/GBM/audio and sandbox dependencies |
| Windows  | `*-windows-x64.zip`        | Windows 10/11 x64, current Steam client                              |
| macOS    | `*-macos-arm64.dmg` or ZIP | Apple Silicon, macOS 13+                                             |

SteamOS and Linux packages contain the same Linux x64 application. Separate downloads identify the intended installation instructions; they do not represent different engines. Intel Mac and Windows ARM64 packages are not supplied. Package inspection is separate from native runtime acceptance: see [VALIDATION.md](VALIDATION.md).

Verify the downloaded file against `SHA256SUMS` from the same private release. No personal key or game artwork is distributed.

## macOS

Open the DMG, drag **Steam Animated Screensaver.app** to Applications and launch it. Alternatively, extract the ZIP and open the app. Native media tools are bundled; Node, Homebrew, Rosetta and a server are not needed.

The private app has an ad-hoc signature, without Apple notarization. If macOS blocks it, use Apple's per-app [Open Anyway](https://support.apple.com/en-us/102445) action. Close the app before replacing it. Removing the `.app` preserves the library and logs.

## Windows

Extract the **entire ZIP** to a user-writable directory and run **Steam Animated Screensaver.exe**. Keep its resources beside the executable. The portable app includes Electron, FFmpeg and FFprobe; no administrator install or Node setup is required. Close the app before replacing the extracted folder. Removing that folder preserves the library and logs in AppData.

## SteamOS and Linux

Extract the archive, enter its directory and run `./install.sh`. The installer writes an owned copy to `~/.local/opt/steam-animated-screensaver` and a desktop entry to `~/.local/share/applications/steam-animated-screensaver.desktop`. It retires an older owned application only after the replacement succeeds. Portable launch: `./steam-animated-screensaver`.

The script refuses linked or unowned destinations. It does not use `sudo`, change SteamOS read-only mode, install system libraries or create a background service. Startup requires the normal Electron sandbox and host libraries; inspect a terminal error rather than adding `--no-sandbox`.

## Prepare and select in Steam

1. In Settings, save and validate a personal SteamGridDB key.
2. Scan installed games, import owned games with a separate optional Steam API key, or add games manually. A SteamID alone identifies an account but does not replace Valve's required API key for owned-library import.
3. In Library, filter/search, then **Select all shown** or **Deselect all shown**. The two library top-100 buttons use current concurrent Steam players or personal total playtime. They replace inclusion only among the owned games in the current filtered list.
4. **Import current Steam top 100** adds available games from Valve's ranking without asserting ownership. New entries are excluded until selected. The upstream top 100 may include software; it is filtered out, so fewer than 100 games can remain. Ranking requests show progress and can be cancelled without changing the previous selection.
5. Open a game’s sheet and use **Change animation / Find animations** at the top to browse alternatives. Choose an animation and **Prepare this game**; fixed artwork and crop choices are retained. Inspect Preview and choose optional 24/30 fps processing.
6. Install from Preparation or Settings. Restart Steam if needed, open **Big Picture → Settings → Customization → Screensavers**, then select **steam-animated-screensaver**. SteamOS Gaming Mode exposes the corresponding Customization settings.

## Steam paths

The export path is always **`<Steam client root>/config/uioverrides/screensavers/steam-animated-screensaver/`**. A secondary game library contributes games but is not a screensaver installation target.

| Platform        | Detected client roots                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| macOS           | `~/Library/Application Support/Steam`                                                                                       |
| Windows         | `HKCU\Software\Valve\Steam` → `SteamPath`, then `%ProgramFiles(x86)%\Steam`, `%ProgramFiles%\Steam`, `%LOCALAPPDATA%\Steam` |
| Linux / SteamOS | `~/.steam/root`, `~/.steam/steam`, `~/.local/share/Steam`, Flatpak `~/.var/app/com.valvesoftware.Steam/.local/share/Steam`  |

A `STEAM_ROOT` environment variable prioritizes a custom client root. Root symlinks are resolved; links inside the configuration override path are refused. Installation copies files only; it never patches the Steam selector or restarts Steam automatically. Idle activation, codecs, wake and controller dismissal require acceptance in each actual Steam client.

## Rename migration and updates

The first new-name launch moves the previous owned data folder to `steam-animated-screensaver` atomically, preserving keys, catalog and cached bytes. Close the previous manager first. If both folders already exist, they are not merged or overwritten. Chromium uses a separate `steam-animated-screensaver-electron` profile so its early lock cannot mask the data migration.

Update / Repair writes the ready included player snapshot and then retires owned exports carrying either historical identifier. It preserves unrelated screensavers. The standalone repair script can rename a single owned historical export without preparing its media again.

After upgrading to 0.1.9, use **Update / Repair** once to remove the introductory loading page from an existing installed Steam snapshot. Restart Steam if it retains the previous page.

Changes appear immediately in Preview; **Update / Repair** applies them to Steam. An installed snapshot works offline with the manager closed. Interrupted preparation can resume; completed files are reused. A malformed catalog is preserved as `.corrupt-TIMESTAMP`. The exclusive library lock detects an active manager and recovers a dead process's stale lock.

## Logs and crashes

Use **Settings → Diagnostic logs → Show JSON log file**. Logs remain local in the data folder's `logs/diagnostics.json`; four older segments are retained. Records include timestamps, version/platform, actions, preparation milestones, errors with stacks and decoder stderr, renderer errors and process-exit details. Writes use a synced temporary file and atomic rename. API keys are redacted from JSON. A failed log write is shown in Settings; the previous valid file is preserved. No log upload is implemented.

Electron crash reporting stores native dumps in `logs/crashes` with upload disabled. A crash event's metadata is also recorded in JSON when the main process can receive it. Native dumps are separate binary diagnostics and can contain process memory. A power loss or uncatchable main-process termination cannot produce a JavaScript stack; the next start identifies the interrupted session instead.

## Purge and removal

**Settings → Local storage → Purge all media** stops preparation and previews, removes cached/processed artwork and the owned Steam snapshot, and keeps games, choices, settings, keys and logs. Previews stay paused until an explicit search/gallery or preparation. Prepare and install again afterward. **Remove unused media** performs a smaller cleanup.

To remove only the Steam export, use **Settings → Steam integration → Uninstall**. To remove the manager, delete the Mac app / extracted Windows folder or run Linux `uninstall.sh`. Data and the installed snapshot remain unless explicitly removed.

Local data paths:

- macOS: `~/Library/Application Support/steam-animated-screensaver`
- Windows: `%APPDATA%\steam-animated-screensaver`
- Linux / SteamOS: `${XDG_CONFIG_HOME:-~/.config}/steam-animated-screensaver`

Close the manager before deleting data. Removing the data folder also removes keys, catalog, media and JSON logs; the separate Chromium profile can be removed independently. Never remove a Steam game library to uninstall this app.

## Automatic start in Big Picture

Select the custom screensaver and test **Preview** first. Steam controls the inactivity timer separately from this app. On Gamescope, its battery/AC timers are in Steam's Power settings. Desktop Big Picture also supports screensavers, but its timer UI can differ.

On the MacBook client inspected on October 16, 2026, **Customization → Configure screensaver timeouts** leads to Power without any timer controls: the link is shown for a device with a battery, while the destination's idle controls require Gamescope. Manual Preview works. A maintainer test subsequently verified automatic custom playback after setting the internal Steam timers in its config file and restarting Steam. A long-delay comparison kept the home screen visible past 70 seconds. This workaround is not yet exposed by the Manager; keyboard/controller dismissal is still unverified. Changing macOS's own screen-saver timeout does not configure Steam. Do not assume a one-minute timer has been set merely because the custom screensaver is selected. This finding applies to the inspected Steam build, not every Mac or future client.
