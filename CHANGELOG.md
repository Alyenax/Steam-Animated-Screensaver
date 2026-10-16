# Changelog

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
