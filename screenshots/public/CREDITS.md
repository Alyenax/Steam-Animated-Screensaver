# App screenshots and demonstration credits

These are screen captures of the actual Steam Animated Screensaver Manager and Player (0.1.9), made for the proposed public 1.0.0 presentation. They use an isolated three-game catalog and copies of already prepared local media. The user's account, API credentials, full library, settings and Steam installation were not copied or modified.

The opening shows the same animation first at its original size, then cropped to 16:9. The recording shows playback, game details/crop controls, preview artwork placement and processing settings. It does **not** claim a live search, owned-library import, a completed smoothing operation or native Steam/Gamescope activation. No image was replaced with an invented UI or a generated mockup. Processing is off in the shown playback; a 30 fps recording does not mean the source animations run at 30 fps.

The screen captures illustrate the application. They do not include standalone reusable game-media files in the application packages, and do not grant a redistribution license to the depicted artwork. The MIT license covers original application code; game/artist material shown in these captures retains its own rights.

| Game             | Animated artwork                                                                           | Still cover                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Balatro          | [Nosebeggar](https://cdn2.steamgriddb.com/hero/8dc2c09b481972807b78402a87b518fd.webp)      | [NNB](https://cdn2.steamgriddb.com/grid/704f72562168940fbfa7e9f01e0f84aa.jpg)    |
| Disco Elysium    | [TUFKAC](https://cdn2.steamgriddb.com/hero/282b71a86a960e117b12b24d88aff20e.webp)          | [Maxine](https://cdn2.steamgriddb.com/grid/7e85bfb04eae1af627743dd44b8686bf.png) |
| Vampire Crawlers | [Blackdraon12099](https://cdn2.steamgriddb.com/grid/5686cd3d88525a81d7cf55f74cce72cb.webp) | [Strom](https://cdn2.steamgriddb.com/grid/d0390da5abdafb939e810c5df4dc4842.png)  |

Source: SteamGridDB. Game rights belong to their respective owners; the app is unaffiliated with Valve, SteamGridDB or the game publishers. Artist credits remain visible in the player. Raw downloaded media and credentials stay outside Git.

## Reproduce the capture

From the project root, with an existing catalog containing at least two ready games with covers:

```sh
node scripts/capture-launch.cjs --catalog /absolute/path/catalog.json --media-dir /absolute/path/media
node scripts/render-launch.cjs
```

The capture script reads only the explicitly supplied catalog and referenced media files, allowlists demo game fields, and verifies the source catalog's hash at the end. Chrome opens a temporary visible recording window; this avoids a headless screencast clipping defect. It uses a temporary local-only credential marker to enable the existing controls, blocks all external network requests and deletes its temporary profile data. It does not read API-key files. No search button is executed using that marker.

The output in `dist/public-launch/CAPTURE.json` records chapters, credits, browser errors, external requests and the source-data preservation check. Video and poster outputs remain local in `dist/public-launch`; the README images are the rendered PNG captures in this directory.
