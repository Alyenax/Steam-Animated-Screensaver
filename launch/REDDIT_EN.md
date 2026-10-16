# Draft — post after the repository and 1.0.0 downloads are public

**Title:** I made a Steam screensaver app using animated SteamGridDB art — looking for testers

After the [October 13 stable Steam update](https://www.steamdeck.com/en/news?pubDate=20261013) added custom screensavers to SteamOS and desktop Big Picture, I wanted to make one with animated artwork from my library.

The app is called Steam Animated Screensaver. Pick your games, choose their animations and still covers, prepare them together, then install the screensaver in Steam. You can keep the full image or crop to 16:9 / 16:10. Once prepared, it plays offline with the app closed. You'll need your own SteamGridDB API key.

The video starts with the result, then shows the batch preparation and settings. There are downloads for SteamOS, Linux, Windows and macOS.

One Steam issue worth mentioning: on devices with a battery outside Gamescope, Big Picture sends you to Power to set the delay, but the controls are missing there. That condition exists in the current Mac, Windows and Linux UI. The app can save the delay after you quit Steam, with a backup; it suggests five minutes. This is separate from your OS screensaver.

After installing, select steam-animated-screensaver in Steam Big Picture → Settings → Customization → Screensavers. The README walks through activation and the delay setting.

[Code and downloads](https://github.com/Alyenax/Steam-Animated-Screensaver)

I'd appreciate testers on every platform, especially Linux and Windows. SteamOS and macOS have had the most hands-on attention. Windows/Linux have automated and package checks, but still need proper testing in Steam on real machines. Please include your OS and Steam version in bug reports.

Contributors would be very welcome too. I'd particularly like help with animation smoothness: many SteamGridDB sources are choppy, and fullscreen makes it obvious. There are optional 24/30 fps processing modes, but they can be slow and results vary. Better processing, fewer crashes, platform fixes, useful additions — I'm happy to have help making this better.

Thanks to the SteamGridDB artists for their work.
