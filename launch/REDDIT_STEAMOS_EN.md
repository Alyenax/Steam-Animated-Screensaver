# SteamOS draft — post after the repository and downloads are public

**Title:** Animated SteamGridDB artwork as a SteamOS screensaver — looking for testers

After Steam's [October 13 stable update](https://www.steamdeck.com/en/news?pubDate=20261013) added custom screensavers, I made Steam Animated Screensaver to use animated artwork from my library in Gaming Mode.

You pick games, choose their animations and optional still covers, prepare everything together, then install it in Steam. There are original, 16:9 and 16:10 framing options. Once prepared, the screensaver runs offline with the app closed. No Decky plugin or background service. You'll need your own SteamGridDB API key.

Setup is in Desktop Mode: extract the SteamOS download and run install.sh, prepare your games, then click Install in Steam. Back in Gaming Mode, go to Settings → Customization → Screensavers and select steam-animated-screensaver. Try Preview, then set the inactivity delay in Steam's Power settings. Five minutes is a reasonable starting point.

Gaming Mode already has the delay controls. Steam has a separate issue on devices with a battery **outside Gamescope**, such as desktop Big Picture: it links to Power but hides the controls there. The app also offers a backed-up delay setting for that case; Steam must be fully closed before applying it.

[Code and downloads](https://github.com/Alyenax/Steam-Animated-Screensaver)

I'd appreciate Steam Deck / Steam Machine testers, including different resolutions and controller setups. Useful things to check: installation, automatic start, returning with a controller, offline playback, and whether playback noticeably affects power use.

Contributors are very welcome too. Many SteamGridDB animations start out choppy, and fullscreen makes it obvious. Optional 24/30 fps processing exists, but it's slow on some sources and quality varies. Help with smoothing, decoding, performance or reliability would be appreciated.

The attached video shows the app interface captured on macOS; it is not a recording of SteamOS Gaming Mode. There are also Mac, Windows and Linux builds; Windows/Linux especially need more real-machine testing.

Thanks to the SteamGridDB artists for their work.
