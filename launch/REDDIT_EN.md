# General draft for when public downloads are available

**Title:** Had an idea for Steam’s new screensavers: animated artwork from your library

When Steam added custom screensavers, I had the idea of using animated SteamGridDB artwork from my library. You pick a few games in Steam Animated Screensaver, prepare them together and let Steam cycle through their animations.

It works in SteamOS Gaming Mode and desktop Big Picture. You can keep the original framing or crop to 16:9 or 16:10, add a still cover and choose a different animation for each game. Once everything is ready, it plays offline with the app closed. You’ll need your own SteamGridDB API key.

Steam hides the timer controls on devices with a battery outside Gamescope. The app lets you set the delay with Steam closed, backing up the settings first. It suggests five minutes.

[Code and downloads](https://github.com/Alyenax/Steam-Animated-Screensaver)

I’d love some testers, especially on Windows and Linux. Those builds have passed automated checks, but need more testing on real machines. Most hands-on testing so far has been on SteamOS and Mac.

I’d also love some help improving it, especially the animation smoothness. SteamGridDB artwork often looks choppy at full screen. Processing at 24 or 30 fps is available, but can be slow and the results vary. Other contributions are welcome too.

Music in the video: [Song Of The Forge by Scott Buckley](https://www.scottbuckley.com.au/library/song-of-the-forge/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
