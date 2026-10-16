# SteamOS draft — post after public downloads are available

**Title:** Had an idea for Steam’s new screensavers: animated artwork from your library

When Steam added custom screensavers, I had the idea of using animated SteamGridDB artwork from my library. That became Steam Animated Screensaver: pick a few games, prepare their animations together and let Steam rotate through them. It plays offline with the app closed. You’ll need your own SteamGridDB API key.

On SteamOS, setup is in Desktop Mode. Then select it in Gaming Mode → Settings → Customization → Screensavers. You can keep the full image, crop to 16:9 / 16:10 and add a still cover.

Gaming Mode already has timer controls in Power. On devices with a battery outside Gamescope, Steam currently hides those controls. The app can save the delay with a backup after you quit Steam. It suggests five minutes.

[Code and downloads](https://github.com/Alyenax/Steam-Animated-Screensaver)

I’d love some Steam Deck / Steam Machine testers. Windows and Linux also need more real-machine testing; most hands-on testing so far has been on SteamOS and Mac.

And if anyone wants to help improve it, I’m very much up for that. Smoothness is the big one: a lot of SteamGridDB animations look choppy fullscreen. The optional 24/30 fps processing can be slow and doesn’t always look great. Help with that, crashes or platform issues would be appreciated.

The app footage in the video was captured on macOS.
