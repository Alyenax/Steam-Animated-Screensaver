# Steam Animated Screensaver

Use animated artwork from [SteamGridDB](https://www.steamgriddb.com/) as a custom screensaver in SteamOS Gaming Mode and Steam desktop Big Picture.

![Full-screen screensaver with a game title and optional still artwork](screenshots/public/screensaver.png)

The image above uses original framing. [See the same scene cropped to 16:9](screenshots/public/screensaver-16x9.png).

Choose games, pick their animations, preview the result and install it in Steam. Once prepared, the screensaver plays offline with this app closed. No Decky plugin or hosted server is needed.

> **1.0.0 is being prepared.** Current downloads are private test candidates. Public downloads will be available after the remaining [release checks](launch/READINESS.md).

## What you can do

- Scan installed games, import an owned library including uninstalled games, or search by title / Steam AppID. Steam tools such as Proton and Linux Runtime are filtered out.
- Select all filtered games, your top 100 by playtime or current Steam player count, or discover Steam's current top 100.
- Choose another animation from a game's details. Pick its still artwork separately and place it beside the title or in three screen corners.
- Keep the original framing, or crop to 16:9 / 16:10 with an adjustable focal point.
- Set scene duration, shuffle and transitions. Optionally process animations at 24 or 30 fps, with a configurable output size limit.
- Follow preparation progress, pause or resume it, clear downloaded media and inspect local JSON error logs.

![Library with prepared games and selection controls](screenshots/public/library.png)

![Game details with animation selection and framing controls](screenshots/public/game-settings.png)

## Downloads and setup

[Releases](https://github.com/Alyenax/Steam-Animated-Screensaver/releases) · [Installation guide](docs/INSTALLATION.md) · [Changelog](CHANGELOG.md)

| Platform                             | Package                        | Launch                                                            |
| ------------------------------------ | ------------------------------ | ----------------------------------------------------------------- |
| SteamOS / Steam Deck / Steam Machine | x64 `.tar.gz`                  | In Desktop Mode, extract and run `./install.sh`                   |
| Linux desktop                        | x64 `.tar.gz`                  | Extract and run `./install.sh`                                    |
| Windows                              | x64 portable `.zip`            | Extract the whole folder and run `Steam Animated Screensaver.exe` |
| macOS 13+                            | Apple Silicon `.dmg` or `.zip` | Drag the app to Applications                                      |

Intel Mac and Windows ARM64 builds are not currently supplied. The Mac app is not notarized and the Windows app is unsigned. See the installation guide for platform requirements and launch instructions.

1. Add a personal [SteamGridDB API key](https://www.steamgriddb.com/profile/preferences/api), then add or scan games. Importing uninstalled owned games additionally needs a Steam Web API key and a SteamID/profile with visible game details; a SteamID alone is not enough for that import.
2. Include the games you want, prepare their media and check **Preview**.
3. Use **Install in Steam**, then select `steam-animated-screensaver` under Steam **Settings → Customization**. Use **Update / Repair** after later changes to update Steam's copy.

The custom screensaver feature requires a recent stable Steam client. Valve introduced it in the [October 13, 2026 stable update](https://www.steamdeck.com/en/news?pubDate=20261013).

## Testing and contributions

Feedback is welcome on every platform. SteamOS and macOS have received the most hands-on attention so far. Windows and Linux packages have automated and package checks, but still need more testing on real machines. That distinction matters: those checks do not establish native Steam playback or long-term stability.

Useful reports include your OS, Steam version, app version, what you did and what happened. For playback issues, include the game, animation source, resolution and processing settings. Review local logs before attaching them; native crash dumps may contain private process data. [Open an issue](https://github.com/Alyenax/Steam-Animated-Screensaver/issues) · [Detailed validation](docs/VALIDATION.md).

Contributors are welcome. Animation smoothing is a particular area for improvement: many source animations have a low frame rate, which is more noticeable fullscreen. The optional processing can be slow and introduce artifacts; it cannot reliably fix every source. Improvements to playback, processing speed, reliability and platform support would be appreciated. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development and credits

```sh
npm ci
npm run check
npm test
npm start
```

Node 22.12+ is required for development. [Architecture](docs/ARCHITECTURE.md) · [Storage and privacy](docs/STORAGE.md) · [Third-party components](docs/THIRD_PARTY.md).

Original application code is [MIT licensed](LICENSE). This is an unofficial community project, unaffiliated with Valve or SteamGridDB. Game artwork belongs to its respective owners and artists; it is downloaded by each user, not bundled with the app. [Visual credits](screenshots/public/CREDITS.md).
