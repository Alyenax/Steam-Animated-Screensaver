# General draft — post after public downloads are available

**Title:** Had an idea for Steam’s new screensavers: animated artwork from your library

When Steam added custom screensavers, I had the idea of using animated SteamGridDB artwork from my library. That became Steam Animated Screensaver: pick a bunch of games, prepare their animations together and let Steam rotate through them.

It works with SteamOS Gaming Mode and desktop Big Picture. You can keep the full image, crop to 16:9 / 16:10, add a still cover and change each game’s animation. Once prepared, it plays offline with the app closed. You’ll need your own SteamGridDB API key.

One Steam quirk: devices with a battery outside Gamescope are missing the delay controls in Power. The app can save the delay after you quit Steam, with a backup. It suggests five minutes; this is separate from your OS screensaver.

[Code and downloads](https://github.com/Alyenax/Steam-Animated-Screensaver)

I’d appreciate testers on all four platforms, especially Windows and Linux. Those have automated/package checks, but need more testing on real machines. SteamOS and Mac have had the most hands-on attention.

Contributors would be welcome too. I’d particularly like help with smoothness: many SteamGridDB sources are choppy fullscreen. The optional 24/30 fps processing can be slow and results vary. Better processing, fewer crashes or useful additions would all be appreciated.
