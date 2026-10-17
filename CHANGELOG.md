# Changelog

## 1.2.0 - October 17, 2026

### App updates from GitHub

- Check for stable releases inside Settings. Daily automatic checks are enabled while the app is open and can be disabled. No GitHub account, token or background service is needed.
- Download an update with a measured percentage and byte count. Cancel a download and retry when ready. Installation always requires **Restart and install** and confirmation.
- Verify an Ed25519-signed release descriptor, platform, version, exact size and SHA-256 before preparing the application. Unsafe archive paths and links are rejected.
- Replace the app after it closes, keep the previous version and restore it if the new app fails to acknowledge a healthy startup. Preserve the library, artwork, API keys and settings; snapshot the catalog before replacement.
- Distinguish the app update from **Update in Steam**, which refreshes the separately installed screensaver without preparing valid media again.
- Keep 10 release assets: four app packages, `update.json`, validation reports, the original demo, checksums and GitHub's two automatic source archives.

### Downloads and installation

Download only the package for your platform. Other release files are the signed update descriptor, grouped validation reports, the original demo and checksums. GitHub also provides two source archives.

| Platform            | Download                                                                                                                                                    | Installation                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| SteamOS Gaming Mode | [SteamOS x64](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.2.0/Steam-Animated-Screensaver-1.2.0-steamos-x64.tar.gz)           | In Desktop Mode, extract the archive and run `./install.sh`.       |
| Linux desktop       | [Linux x64](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.2.0/Steam-Animated-Screensaver-1.2.0-linux-x64.tar.gz)               | Extract the archive and run `./install.sh`.                        |
| Windows 10 or 11    | [Windows x64 portable ZIP](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.2.0/Steam-Animated-Screensaver-1.2.0-windows-x64.zip) | Extract the whole folder and run `Steam Animated Screensaver.exe`. |
| macOS 13 or later   | [Mac Apple Silicon DMG](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.2.0/Steam-Animated-Screensaver-1.2.0-macos-arm64.dmg)    | Open the DMG and drag the app to Applications.                     |

### First upgrade and Steam playback

1. Versions up to 1.1.1 have no internal updater. Download and install 1.2.0 once using the table above. Existing app data is preserved.
2. For future versions, open **Settings → App updates**, click **Check for updates**, then **Download update**. When verification finishes, click **Restart and install** and confirm.
3. After the app restarts, click **Update in Steam** if the installed screensaver needs refreshing. App updates do not automatically rewrite Steam's installed copy.
4. For a first screensaver installation, choose games, **Prepare scenes**, check **Preview**, then **Install in Steam**.
5. In Steam Big Picture or SteamOS Gaming Mode, open **Settings → Customization → Screensavers**, select **steam-animated-screensaver** and try **Preview**. Restart Steam if it is missing.
6. Set the inactivity delay in Steam. If the controls are missing, fully quit Steam and use **Settings → Automatic start in Steam** in the app, then reopen Steam. The app can be closed during playback.

Mac startup, replacement and rollback are tested with isolated native app copies. Windows, Linux and SteamOS packages are inspected and their updater logic is tested, but native update acceptance on those targets remains pending. Read-only installations offer the GitHub download for manual installation. More details: [App updates](docs/UPDATES.md).

## 1.1.1 - October 17, 2026

### Optional playback credits

- Hide artist credits by default, including when upgrading an existing library.
- Choose animation artwork, still cover and game logo credits independently in Preview or Settings. Saved choices are retained after restarting the app.
- Apply the same credit choices to offline Steam playback. Credits for a hidden or missing cover or logo stay hidden.
- Apply credit changes with **Update in Steam**. Preparing or downloading media again is not required. Artist information remains stored with the media.

### Downloads and installation

Download only the package for your platform. Other release files are optional developer sources, grouped validation reports, the original demo and checksums.

| Platform            | Download                                                                                                                                                    | Installation                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| SteamOS Gaming Mode | [SteamOS x64](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.1.1/Steam-Animated-Screensaver-1.1.1-steamos-x64.tar.gz)           | In Desktop Mode, extract the archive and run `./install.sh`.       |
| Linux desktop       | [Linux x64](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.1.1/Steam-Animated-Screensaver-1.1.1-linux-x64.tar.gz)               | Extract the archive and run `./install.sh`.                        |
| Windows 10 or 11    | [Windows x64 portable ZIP](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.1.1/Steam-Animated-Screensaver-1.1.1-windows-x64.zip) | Extract the whole folder and run `Steam Animated Screensaver.exe`. |
| macOS 13 or later   | [Mac Apple Silicon DMG](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.1.1/Steam-Animated-Screensaver-1.1.1-macos-arm64.dmg)    | Open the DMG and drag the app to Applications.                     |

### Apply it in Steam

1. For a first installation, choose games, click **Prepare scenes**, check **Preview**, then **Install in Steam**.
2. In **Preview** or **Settings → Artist credits**, enable only the credits you want. All three choices are off by default.
3. For an existing Steam installation, click **Update in Steam** to apply the credit settings. No new preparation is needed for this change.
4. In Steam Big Picture or SteamOS Gaming Mode, open **Settings → Customization → Screensavers**, select **steam-animated-screensaver** and try **Preview**. Restart Steam if it is missing.
5. Set the inactivity delay in Steam. If the controls are missing, fully quit Steam and use **Settings → Automatic start in Steam** in the app, then reopen Steam. The app can be closed during Steam playback.

Windows and Linux still need more hands-on testing on their target systems. Package checks and macOS execution do not establish native behavior on those platforms.

## 1.1.0 - October 17, 2026

### Game logos

- Show a game's logo beside its cover by default. The game title automatically replaces a missing or unreadable logo.
- Choose title, logo, both or neither. Position the logo beside the cover or in any of the four corners, with consistent screen margins and space for the cover.
- Find alternative SteamGridDB logos in the game sheet. Override the display mode and position for individual games.
- Keep prepared logos with the offline Steam export. Preparing an existing library downloads missing logos while reusing valid animations.

### Preparation and installation

- Follow **Choose games → Prepare → Install in Steam** at the top of the app.
- Use the **Prepare and install** navigation entry, with live progress and a pending-installation or update badge.
- Prepare selected games from the top of the library. Once ready, a prominent **Install in Steam** or **Update in Steam** button shows the next step.
- Detect when prepared media or playback settings differ from the installed copy. Keep **Repair installation** in Settings as a separate maintenance action.
- After installation, show how to select the screensaver in Steam. Installation does not select it automatically.

### Downloads and installation

Download only the package for your platform. Other release files are optional developer sources, grouped validation reports, the original demo and checksums.

| Platform            | Download                                                                                                                                                    | Installation                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| SteamOS Gaming Mode | [SteamOS x64](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.1.0/Steam-Animated-Screensaver-1.1.0-steamos-x64.tar.gz)           | In Desktop Mode, extract the archive and run `./install.sh`.       |
| Linux desktop       | [Linux x64](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.1.0/Steam-Animated-Screensaver-1.1.0-linux-x64.tar.gz)               | Extract the archive and run `./install.sh`.                        |
| Windows 10 or 11    | [Windows x64 portable ZIP](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.1.0/Steam-Animated-Screensaver-1.1.0-windows-x64.zip) | Extract the whole folder and run `Steam Animated Screensaver.exe`. |
| macOS 13 or later   | [Mac Apple Silicon DMG](https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.1.0/Steam-Animated-Screensaver-1.1.0-macos-arm64.dmg)    | Open the DMG and drag the app to Applications.                     |

### Apply it in Steam

1. Choose games and click **Prepare scenes**. If upgrading, prepare once to fetch game logos; existing valid animations are reused.
2. Check **Preview**, then click **Install in Steam** or **Update in Steam** in the highlighted panel.
3. In Steam Big Picture or SteamOS Gaming Mode, open **Settings → Customization → Screensavers**, select **steam-animated-screensaver** and try **Preview**. Restart Steam if it is missing.
4. Set the inactivity delay in Steam. If the controls are missing, fully quit Steam and use **Settings → Automatic start in Steam** in the app, then reopen Steam. Five minutes remains the suggested starting point.
5. After changing prepared content, logos, framing or playback settings, click **Update in Steam** again. The app can be closed during Steam playback.

Windows and Linux still need more hands-on testing on their target systems. Package checks and macOS execution do not establish native behavior on those platforms.

## 1.0.0 - October 16, 2026

First public release by Alyenax, under GPL-3.0-only.

- Include GPLv3 and retained notices in all four platform packages. Optional support is available through Ko-fi and GitHub's Sponsor button.

- Turn animated SteamGridDB artwork into an offline screensaver for SteamOS Gaming Mode and desktop Big Picture.
- Add installed or uninstalled games, search manually, select all, or choose a top 100. Steam runtime components are filtered out.
- Change each game's animation and still cover. Keep the full image or crop to 16:9 / 16:10.
- Follow preparation progress and optionally process animations at 24 or 30 fps. Clear downloaded media and inspect local error logs.
- Set separate Steam inactivity delays for AC and battery. A first configuration proposes **5 minutes**; existing choices are kept. Applying makes a private backup and requires Steam to be fully closed.
- Work around Steam's missing delay controls on devices with a battery outside Gamescope. The UI condition and storage were checked in the current macOS, Windows and Linux clients; Windows/Linux native testing remains needed.
- Supply SteamOS, Linux and Windows x64 packages, plus a macOS Apple Silicon DMG and ZIP. English and French are included.

### How to activate it

1. In the app, choose games, **Prepare**, check **Preview**, then **Install in Steam**.
2. In **Steam Big Picture → Settings → Customization → Screensavers**, select **steam-animated-screensaver** and test **Preview**. SteamOS Gaming Mode uses the same Customization section. Restart Steam if the new entry is missing.
3. Quit Steam completely using **Exit / Quit Steam**. In the app, open **Settings → Automatic start in Steam**, choose the delays (start with **5 minutes**) and click **Apply Steam delays**.
4. Reopen Steam in Big Picture or Gaming Mode. The screensaver starts after inactivity; the app can be closed. After later media or playback changes, use **Update / Repair**.

Steam's timer is separate from your operating system's screensaver, display sleep and lock settings.

[Installation guide](docs/INSTALLATION.md) · [Known testing limits](docs/VALIDATION.md) · [Earlier development versions](docs/DEVELOPMENT_CHANGELOG.md) · [Release details](launch/READINESS.md).
