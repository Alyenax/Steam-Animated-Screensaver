# Steam Animated Screensaver 1.0.0

First public release by Alyenax.

Choose games from your Steam library or search manually, prepare their animated SteamGridDB artwork together, then install the result as a Steam screensaver. Prepared playback works offline with the app closed. Choose each game's animation and still cover, keep the original framing or crop to 16:9 or 16:10, and optionally process animations at 24 or 30 fps.

## Activate it

1. Choose games in the app, click **Prepare**, check **Preview**, then **Install in Steam**.
2. In Steam Big Picture or SteamOS Gaming Mode, open **Settings → Customization → Screensavers**, select **steam-animated-screensaver** and test **Preview**.
3. Set the inactivity delay in Steam's Power settings where available. On devices with a battery outside Gamescope, Steam currently hides those controls. Quit Steam completely, open **Settings → Automatic start in Steam** in the app, choose the delays and click **Apply Steam delays**. The app makes a backup first. Five minutes is the suggested starting point.
4. Reopen Steam and leave it idle. The app can be closed. Use **Update / Repair** after changing prepared content or playback settings.

Your operating system's screensaver, display sleep and lock settings are separate.

## Downloads and testing

SteamOS, Linux and Windows downloads are x64. macOS downloads support Apple Silicon on macOS 13 or later and include both DMG and ZIP. The app starts in English and also supports French.

Windows is unsigned. The Mac app is ad-hoc signed and not notarized. SteamOS and Mac have had the most hands-on testing. Windows and Linux builds have automated and archive checks, but need more real-machine testing inside Steam. Animation smoothness depends on the original artwork, and optional processing can be slow. Contributions and useful bug reports are welcome.

The release includes source, third-party media sources and build recipes, checksums, and validation reports. Build and package checks run locally.
