# App screenshots and demonstration credits

Library, artwork and batch-preparation captures show the actual Steam Animated Screensaver Manager/Core/Player 0.1.9 in a disposable Mac profile containing ten selected games. The automatic-start panel was captured from the current 0.1.11 code in a separate disposable Steam configuration, with both five-minute values actually applied. The video does not relabel the older footage as a newer app version. The real SteamGridDB provider automatically selected and prepared all ten games: 10 ready, zero errors, about 85 seconds. No generated UI or simulated preparation is shown. The alternatives gallery was recorded after its visible thumbnails decoded successfully.

The final 89-second video opens with the same Elden Ring animation in original framing and a true 16:9 crop. All ten requested games appear. The preparation section is explicitly accelerated 8×; artwork playback remains real time. The app's optional 30 fps light-blend processing was actually run for the five lower-cadence sources; already-fluid sources retain their originals. No frame interpolation is applied in the editor. Processing quality still depends on the source.

The README's `screensaver-demo.gif` is a silent, looping 12-second excerpt from the start of that video, showing Elden Ring in both framings followed by Cyberpunk 2077. It is reduced to 800 pixels wide and 20 fps for page loading, with no change to playback speed. Reproduce it with `node scripts/create-readme-gif.cjs` after preparing the demo video. The artwork credits below apply to this GIF too.

Native ScreenCaptureKit records only the selected app window, up to 60 fps. Capture-only focus/visibility emulation prevents normal background pausing; the distributed application is unchanged. Scene changes use the Player's existing API. These presentation checks do not prove Steam idle activation or Windows/Linux native execution. The custom export was separately installed in Mac Steam and its selected entry was observed, and the user confirmed animated playback in Steam Preview. A subsequent native test verified automatic activation with the Steam timer workaround and a long-delay comparison; physical keyboard interruption was subsequently confirmed by the maintainer. Controller/mouse dismissal has not been separately accepted. The MacBook timeout UI issue is documented in the validation report. The last eight seconds use the separate native Steam recording of automatically activated playback on macOS; they do not claim Windows/Linux runtime validation.

The original account catalog/media are read as source material. Its key is copied into the disposable profile for real provider calls, never displayed, and deleted after the run. The user's app library is unchanged. The ten-game export is intentionally installed in Steam for the requested acceptance test.

| Game | Animated artwork | Still cover |
| --- | --- | --- |
| ELDEN RING | [TUFKAC](https://cdn2.steamgriddb.com/hero/2c9f13441c3f36d9422d5de661e57742.webp) | [Morente](https://cdn2.steamgriddb.com/grid/557fa68027943a8b0d3b66c4e72ff23b.png) |
| Cyberpunk 2077 | [fewwan](https://cdn2.steamgriddb.com/hero/a834433907aae376f0fdc19875b6678e.webp) | [jho](https://cdn2.steamgriddb.com/grid/81c4ff81e06c236f16a408089a8cd2ac.png) |
| HELLDIVERS™ 2 | [Senny](https://cdn2.steamgriddb.com/hero/3e1f618033945f210a55c8d77277cfc9.webp) | [NiCKNRS83](https://cdn2.steamgriddb.com/grid/ebaf6c4a459d9c2ab207b09401582925.jpg) |
| Red Dead Redemption 2 | [BrownPuppy](https://cdn2.steamgriddb.com/hero/a251de3802b378fcdc57d8ad7ecf562a.webp) | [Ash735](https://cdn2.steamgriddb.com/grid/22774e7dbd2a3030e3e0c0b7381dee3e.png) |
| Disco Elysium | [TUFKAC](https://cdn2.steamgriddb.com/hero/282b71a86a960e117b12b24d88aff20e.webp) | [Maxine](https://cdn2.steamgriddb.com/grid/7e85bfb04eae1af627743dd44b8686bf.png) |
| Don't Starve Together | [ECHOSUD](https://cdn2.steamgriddb.com/hero/75b732607f7f166f009b1ebc92bab9a3.webp) | [Dauk](https://cdn2.steamgriddb.com/grid/090f5b3b995842fb6c1ad838719d3412.png) |
| Tom Clancy's Rainbow Six Siege | [Holograms](https://cdn2.steamgriddb.com/hero/90695eadb354247fd213e6f99e85d8f7.webp) | [Tdizzl3d](https://cdn2.steamgriddb.com/grid/6df0f11ac980d2c59e5b4dab6a8e7611.png) |
| Baldur's Gate 3 | [TUFKAC](https://cdn2.steamgriddb.com/hero/761635701a1b57e55385d45e8e868498.webp) | [Maxine](https://cdn2.steamgriddb.com/grid/698421cd435e8c366644e68696da7486.png) |
| Left 4 Dead 2 | [Mikachuuu_](https://cdn2.steamgriddb.com/hero/0969cc92581148eb5f98f23e4f9e17c6.webp) | [Motka](https://cdn2.steamgriddb.com/grid/879c7c9a27682b01e41948a42cea0cbe.png) |
| ARC Raiders | [BrownPuppy](https://cdn2.steamgriddb.com/hero/a7e16024da6555834545cbabbdca9295.webp) | [r_dsgnd](https://cdn2.steamgriddb.com/grid/de7eac7d1f55e2064a021725aa4ee552.png) |

Source: SteamGridDB. Game rights belong to their respective owners; this project is unaffiliated with Valve, SteamGridDB or the publishers. Artist credits remain visible. The MIT license covers original app code, not third-party artwork. Raw media and credentials stay outside Git and app packages.

## Capture tools

Development-only scripts: `capture-window-macos.m`, `capture-launch-native.cjs`, `prepare-demo-smoothing.cjs`, `capture-demo-player.cjs`, `capture-demo-settings.cjs`, `capture-demo-alternatives.cjs`, and `render-launch-native.cjs` under the root scripts directory. They require the local prepared demo bundle, native media tools, an existing local SteamGridDB key and macOS screen recording permission. Outputs remain ignored in `dist/public-launch-v2`; the final named file is `Steam-Animated-Screensaver-demo.mp4`. The separate `capture-steam-idle.cjs` script records the current guarded five-minute flow without changing a personal Steam config. These are maintainer presentation tools, not a consumer setup path.

Music: **Song Of The Forge by Scott Buckley, released under CC BY 4.0. www.scottbuckley.com.au**. The recording is excerpted, level-matched and faded for the video: [source, license and reproduction](../../launch/MUSIC.md). The music license does not cover the artwork.
