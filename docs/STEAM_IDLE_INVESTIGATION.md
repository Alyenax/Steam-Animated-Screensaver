# Steam Big Picture inactivity controls

Inspected on October 16, 2026, **before enabling Windows/Linux configuration writes**. This is a static investigation of Valve's distributed stable client, supported by a separate native Mac test. It is not a native Windows/Linux acceptance report.

## Official client examined

The current stable manifests for [Windows x64](https://client-update.fastly.steamstatic.com/steam_client_win64), [Linux](https://client-update.fastly.steamstatic.com/steam_client_ubuntu12) and [macOS](https://client-update.fastly.steamstatic.com/steam_client_osx) all reported **1791918634**. All three referenced the same `steamui_websrc_all` archive and SHA-256. The older `steam_client_win32` manifest is not the current Windows x64 client and was excluded from the conclusion.

Downloaded the official UI archive and Windows/Linux native binary archives, verified their manifest SHA-256 values, then inspected `steamui/sp.js`, `SteamUI.dll` and `ubuntu12_32/steamui.so`. The Mac native descriptor was checked in the installed `steamui.dylib`. No Steam executable or UI code was executed from these downloads, patched or redistributed. Exact URLs, hashes and storage details are in [STEAM_IDLE_INVESTIGATION.json](STEAM_IDLE_INVESTIGATION.json).

## UI condition

In the shared minified UI, Customization's timeout component `js(Rr)` calls `$n()`. The latter returns `Ei.Jy() || IN_GAMESCOPE`. Module `20429` exports `Jy` as a read of `batteryState.bHasBattery`.

When that condition is true, Customization links to Power instead of rendering its timeout dropdown. Power's idle-settings component `hn(Rr)` renders those controls only when `IN_GAMESCOPE` is true. There is no macOS/Windows/Linux branch in these conditions.

| Client environment | Result in this stable UI |
| --- | --- |
| Battery present, outside Gamescope | Customization links to Power, but Power hides the idle controls |
| No battery, outside Gamescope | Customization directly renders the timeout dropdown |
| Gamescope | Power renders plugged-in controls and, when relevant, battery controls |

This explains the observed MacBook UI and establishes the same condition for Windows/Linux laptops using this shared client UI. It does not imply every Windows/Linux desktop lacks the setting. Actual battery detection and native idle activation on those systems remain hardware-dependent and require testing.

## Storage verified before implementation

All three native clients contain `system_idle_screensaver_ac_sec` and `system_idle_screensaver_battery_sec` descriptors with install-store option `80 a6 1d 01`. The enum identifies `ConfigStore_Install = 1`, while `Registry = 4`. Despite the Windows-looking backslashes in descriptor paths, these fields use the install configuration file on Windows too.

The paths are `Software\Valve\Steam\System\IdleScreensaverACSeconds` and `Software\Valve\Steam\System\IdleScreensaverBatterySeconds` in `config/config.vdf`'s `InstallConfigStore`. Native default values are 300 seconds on AC and 0 on battery. No Windows Registry change is needed.

The app therefore uses the same narrowly scoped config writer on all supported platforms, with platform-specific Steam process detection. It does not add an idle watcher, background service, OS screensaver or Steam code patch. Steam must be fully closed to apply. The writer retains original configuration text, creates a private backup, checks for concurrent changes, commits atomically and reads the result back.

## Runtime evidence and limits

On the maintainer's Mac, setting both values to 60, restarting Steam and entering Big Picture produced automatic custom playback and scene rotation without Preview or ForceScreensaver. A comparison at 3600 seconds remained on Steam Home beyond 70 seconds. The maintainer physically confirmed keyboard interruption. Battery playback, controller/mouse dismissal and long-duration stability remain unaccepted.

The feature's new writer and controls are tested using isolated Steam folders and injected running/closed/failing process checks. This does not substitute for native Steam tests on Windows/Linux/SteamOS. A later Valve release may change this internal schema or UI condition.
