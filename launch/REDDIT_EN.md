# Draft — post only after the repository and 1.0.0 downloads are public

**Title:** I made an app to use animated SteamGridDB art as a Steam screensaver — looking for testers

With the [October 13 stable Steam update](https://www.steamdeck.com/en/news?pubDate=20261013) adding custom screensavers to SteamOS and desktop Big Picture, I wanted to try using animated art from my library.

So I made Steam Animated Screensaver. Pick your games, choose animations from SteamGridDB, preview them and install the screensaver in Steam. You can change the crop, add a separate still cover and move it around. Once everything is downloaded, it plays offline with the app closed. You'll need your own SteamGridDB API key to get the artwork.

The video starts with the result, then shows a few settings.

[Code and downloads](https://github.com/Alyenax/Steam-Animated-Screensaver)

I'd appreciate testers on SteamOS, macOS, Linux and Windows. I've spent the most hands-on time with SteamOS and macOS. Linux and Windows have had automated/package checks, but much less attention on real machines, so feedback there would be especially useful. Please include your OS and Steam version if something goes wrong.

Contributors would be very welcome too. One thing I'd really like to improve is animation smoothness. A lot of SteamGridDB animations are quite choppy to begin with, and fullscreen makes it obvious. There are optional 24/30 fps processing modes, but they can be slow and the results vary. If you know a better way to handle that, I'd love some help. Same goes for making the app more reliable or adding something useful.

Thanks to the SteamGridDB artists whose work makes this possible.
