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

1. Install the prepared scenes and select **steam-animated-screensaver** in **Steam Big Picture → Settings → Customization → Screensavers**. Check **Preview** once.
2. Quit Steam completely using **Steam → Exit / Quit Steam**; closing its window is insufficient.
3. In our app, open **Settings → Automatic start in Steam**. Choose **Plugged in** and **On battery** delays (start with 5 minutes). Use **Disabled** to turn either timer off. Click **Apply Steam delays**.
4. Reopen Steam in Big Picture or Gaming Mode and leave it idle. The manager can be closed. A keyboard input interrupted playback in the maintainer’s Mac test; controller/mouse dismissal still needs platform testing.

The app reads and changes only Steam’s `IdleScreensaverACSeconds` and `IdleScreensaverBatterySeconds` in `config/config.vdf`, under `InstallConfigStore/Software/Valve/Steam/System`. It refuses to write while Steam is running, backs up the original privately beside it as `config.vdf.sas-idle-*.bak`, preserves other settings and verifies the saved values. **Read Steam settings again** discards unapplied choices and reads current values. When neither delay has been saved, the app proposes 5 minutes for both and shows Steam’s current defaults separately (5 minutes plugged in, disabled on battery). Nothing is written until Apply. Existing saved delays, including Disabled, are preserved.

This option is available on macOS, Windows and Linux/SteamOS. It also works where Steam already exposes its own timer controls. The October 16 investigation of stable Steam **1791918634** found the same UI condition across platforms: machines with a battery outside Gamescope get a link to Power, whose idle controls require Gamescope. Desktops without a battery have a direct timer in Customization; Gamescope has the controls in Power. See [the investigation](STEAM_IDLE_INVESTIGATION.md) and its source hashes.

Automatic custom playback and timer persistence have been observed in native Steam on the maintainer’s Mac. Windows/Linux support is based on first-party client-code inspection, isolated configuration tests and package checks; native Steam acceptance remains pending there. Valve may change these internal settings in a later update.

Your operating system’s screensaver, display sleep and lock settings remain separate and may interrupt Steam. Changing macOS’s own screensaver delay does not configure Steam. Selecting the custom screensaver alone does not set its inactivity timer.
