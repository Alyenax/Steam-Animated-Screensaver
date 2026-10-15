# Offline player and Steam integration

## Runtime evidence (15 October 2026)

Valve's [Steam Client Update of 13 October 2026](https://www.steamdeck.com/en/news?pubDate=20260808) announces custom screensavers on the Stable channel. It identifies `~/.steam/root/config/uioverrides/screensavers/` and points developers to the built-in bouncing-logo files in `steamui/screensavers`. The selection UI is **Settings → Customization**. Steam owns idle detection and resuming activity; this player does not intercept keyboard, mouse, gamepad or Steam events.

The public [Acerocks22/tabs-screensavers tree](https://github.com/Acerocks22/tabs-screensavers/tree/0c664f0a8521902ae67cc7e826b155c92ca840f9) was inspected at commit `0c664f0a8521902ae67cc7e826b155c92ca840f9`. Its `windowspipes/index.html`, local JavaScript and local assets illustrate the named-directory layout. No source from that project, Valve's implementation, or the private GabeCubeAura Lab was copied.

The installer creates:

```
<Steam root>/config/uioverrides/screensavers/steamos-animated-screensaver/
  index.html
  player.js
  player.css
  catalog.js
  .steamos-animated-screensaver.json
  media/<prepared playback and thumbnail files>
```

Steam opens installed players through a mapped HTTPS hostname. The directory identifier is a lowercase DNS label, separate from the display title. Version 0.1.1 migrates owned 0.1.0 directories after successful replacement; see STEAM_ERROR_105.md. This layout and host-origin test do not prove that a particular Steam client successfully launches the candidate. The physical SteamOS checks below remain necessary.

## One engine, two hosts

The Manager iframe and installed screensaver use the same `player/index.html`, `player.js` and `player.css`. The installed catalog is a local script, so loading requires no fetch, server, API key, account session or network. Its content security policy blocks connections and remote assets. Local relative URLs are used in the installation; preview supports same-origin `/media/` URLs and the Electron application's `app://cinema/media/` URLs.

The preview accepts catalog and control messages only from its parent window, with a matching origin. Steam's standalone host needs no message bridge. The global `CinemaPlayer` API exposes play, pause, previous, next, settings and destroy. Preview fullscreen is owned by the Manager; this iframe does not acquire input or fullscreen itself.

There is one moving artwork decoder in steady state, and at most two while crossfading or preparing a transition. The blurred ambient layer uses the thumbnail, so it never duplicates a video decoder. Rapid navigation cancels and unloads pending scenes as well as retired scenes. Original framing uses `object-fit: contain`; the separate blurred background fills the display without stretching the artwork. Crossfade and fade-to-black are supported. Reduced motion removes scene fades and the optional static-image camera drift; genuine artwork animation continues.

`showLogos` is the version-1 settings key for the rendered game title. It cannot remove logos already embedded in an artwork. Credits remain visible. From 0.1.2, the promotional sentence above scene titles is removed in both languages. Static fallback is excluded unless explicitly enabled and has a visible static-artwork label.

Scene failures skip to the next eligible game. When all eligible files fail, the player stops retrying and displays a repair message. Pause stops videos, playlist timers and static camera drift. Native GIF/WebP animations are frozen onto a canvas and their image source is unloaded, so the native animation also stops. Browser canvas semantics expose the animation's default frame, so pausing a GIF/WebP resets it to that still frame rather than retaining its precise displayed frame. Resuming reloads the original animation from its beginning, then removes the canvas after the image is ready. At most one canvas per paused native-image scene exists (two during a transition), and all canvases are released on scene cleanup. Page hiding applies the same pause behavior; page teardown unloads sources and removes timers and message listeners.

## Display cropping (0.1.6)

`framing: original|16:9|16:10` defaults to Original. Each game can override it with `crop: {mode: inherit|original|16:9|16:10, x:0..100, y:0..100}`. Cropped modes fit the largest exact-ratio frame within the viewport and use `object-fit: cover` with the selected focal position. The blurred surround fills any remaining screen area. Resize recalculates frame dimensions; titles, credits and fixed covers keep their screen margins.

The crop is a display operation and preserves source bytes, duration, cadence and existing smoothing derivatives. Preview updates immediately; the installer exports both general and per-game settings. Update / repair applies changes to Steam. No re-encoding or preparation is required. The Manager disables focal axes without clipping and keeps Original as the migration default.

## Manager image previews

SteamGridDB may return a **video/webm** thumbnail for an animated artwork, including search heroes. Since 0.1.3 the Manager requests `previewImage` to decode a still JPEG locally, rather than inserting that video URL into an image element. Two coalescing preview lanes normalize visible thumbnails; shared references reuse cached files, and off-screen galleries load lazily. Source bytes are signature-checked before explicit decoders and all remote redirects stay on the approved CDN. JPEG/GIF/WebP/PNG and WebM inputs are covered by real decoder tests.

Missing game-thumbnail metadata is resolved on demand by verified Steam/SGDB IDs, including search results after the initial eight. Static Grids provide a fallback if no Hero thumbnail exists. A missing/corrupt thumbnail can fall back to its available original source. Exhausted candidates display an unavailable placeholder; closing/reopening the view retries failed requests. Home/detail native-media failures also fall back to a still image. Player playback remains entirely independent of this preparation-time preview service.

## Fixed covers and smoothing

`showCover` defaults to true independently of `showLogos`. `coverPosition` is one of `beside-title` (default), `bottom-right`, `top-right`, `top-left`. Shared CSS variables use 5.6vw horizontally and 7vh vertically; bottom-right reserves title space to prevent overlap. The image is static, proportional and local. It uses a separately validated portrait Grid when available or the animation's local JPEG thumbnail. A failed cover falls back to the thumbnail without skipping the animation; a failed thumbnail hides only the cover. Cover artist credit is displayed when that cover is visible. All scene images are released during cleanup.

`smoothMotion` defaults to false and affects preparation/export selection, not runtime computation. [FFmpeg motion-compensated interpolation](https://ffmpeg.org/ffmpeg-filters.html#minterpolate) creates a separate 30 fps, silent VP9 file with a maximum 1920×1080 bounding box and no upscaling. GIF/WebM are decoded directly; animated WebP frames are decoded into RGBA rectangles and composed with offsets, alpha, blend and disposal flags before an internally generated local PNG concat sequence preserves frame durations. The original source remains untouched. Media already at approximately 30 fps or above retains its original frame rate.

Each variant records its original SHA-256; a changed animation invalidates the variant. Turning smoothing off immediately selects the original in Preview; use Update / repair to republish that choice to Steam. Preparation reuses validated sources and variants without another download. Failed optional processing preserves the original and surfaces an error in Preparation. Interpolation may produce artifacts and cannot repair loop discontinuities or prove target-device decoding performance.

From 0.1.3, `maxSmoothingMB` is the manual per-video output limit in MiB; 0 defaults to no per-video limit. The configured total cache budget and available disk space still apply. Interpolation has no fixed 160 MiB output/temporary-frame ceiling or automatic three-minute processing deadline. User cancellation and the Linux game-pause guard remain active. Video signatures and source hashes are read with bounded memory, so valid processed files above 160 MiB are accepted. All temporary work is removed on normal failure/cancellation. Explicit unused-media cleanup can remove abandoned frame folders with the exact application marker, preserving other folders. If a manual size limit or available storage is exhausted, the original playback remains available with a visible processing error.

## Media trust boundary

Downloads accept HTTPS on `cdn2.steamgriddb.com` and `cdn.steamgriddb.com` only. Every redirect is checked again; credentials, custom ports, other hosts, non-HTTPS URLs and unbounded redirect chains are refused. Downloads have a 120-second whole-request deadline and a 160 MiB maximum; callers may enforce a smaller remaining-storage budget. Incomplete files are removed on cancellation or errors.

Downloaded files are classified by their bytes before invoking a decoder. Only GIF, RIFF WebP, PNG, JPEG and EBML WebM/Matroska signatures enter explicit FFmpeg demuxers. HLS, concat and other auto-detected manifest inputs are rejected before a process can read their references. FFmpeg/FFprobe use argument arrays, no shell, local file/pipe protocols and bounded process output. Normal input validation/preparation has a 180-second process deadline; explicitly requested interpolation and its processed-video validation do not use that hidden deadline. Preparation limits dimensions to 3840 × 2160 pixels in total, duration to 10 minutes, and frame count to 18,000.

FFprobe measures dimensions, duration, frame count and codec. FFmpeg actually decodes supported input streams; checking extension or MIME alone is insufficient. For animated WebP, the RIFF/ANMF structure, dimensions, canvas placement, lengths and durations are checked, and each frame's WebP image payload is decoded through an explicitly selected image pipe. This avoids depending on FFmpeg versions that cannot directly demux animated WebP. The original animated WebP remains the playback source, retaining its proper compositing in the browser. An ANMF thumbnail is taken from the first image payload; artwork with a partial first frame can therefore have a cropped ambient thumbnail while its original animation remains intact.

GIF/WebP and compatible VP8/VP9 WebM are retained without re-encoding. Other decodable WebM video codecs are converted once to silent VP9 WebM. Original bytes are always retained separately when conversion is needed, and SHA-256 is stored. No package manager or global installation runs. Binaries are resolved from packaged `binaries/`, then the configured FFmpeg paths or installed development modules. Prepared thumbnail and source integrity are checked when reusing cached media. Validation is cancellable.

FFmpeg decoding is software validation, not proof of the Steam browser's codec support or GPU performance. Native browser GIF/WebP decoding, VP9, autoplay policy, looping and memory behavior must be checked on the target Steam client.

## Installation safety and recovery

The installer copies only included, ready playback files and their thumbnails. It excludes original-only source files, API credentials and source download URLs. Basenames and media-directory ownership are checked; symlink media files and parent directories are refused. Steam's root symlink may resolve normally, while symlinks inside its configuration override path are refused.

Installation stages all files beside the destination, validates ownership, renames the previous owned folder aside, and commits the new directory. Failed staging leaves the old installation untouched. A failed commit restores it. Uninstall refuses to touch a folder without the application ownership marker and leaves neighboring screensavers intact. Installation and uninstall share a per-Steam-root lock.

Normal cancellation removes temporary downloads, encodes and thumbnails. A forced process kill can leave unreferenced UUID `.partial`, `.webm` or `.jpg` files; the Manager's unused-media cleanup can remove these. If a process is killed while holding the install lock, the next attempt reports the exact `.steamos-animated-screensaver.lock` folder to remove after confirming that no Manager is installing. A crash precisely between the backup rename and new-folder rename can leave `.cinema-backup-<UUID>` beside the destination; rename that owned backup to `steamos-animated-screensaver` to recover it. Never remove unrelated override folders.

## Verified locally

Node tests cover CDN URL and redirect restrictions, oversize/truncated downloads, cancellation, hostile manifest signatures, symlink escapes, retained-source integrity, corrupted thumbnails, real FFmpeg preparation of GIF/animated WebP/VP9 WebM, static-artwork rejection, installer ownership/rollback/uninstall and catalog filtering.

`tests/player-browser.test.cjs` generates an original synthetic VP9 fixture, runs this exact player in isolated headless Chrome and verifies real video time advancement, video pause, identical paused GIF/WebP screenshots and resumed moving frames, paused static camera drift, repeated canvas cleanup, parent controls, rapid navigation decoder bounds, undistorted resizing, missing-file skipping, all-failed recovery, local-only requests and teardown. It also invokes the real installer and verifies the exported player directly over `file://`, checking that every playback request remains a local file and real video time advances. It uses a configured `CINEMA_TEST_BROWSER`, Playwright Chromium when available, or installed macOS Chrome. Environments without a browser skip this explicitly; that skip does not count as playback validation.

## Target SteamOS acceptance still required

1. Install the Linux candidate on Steam Deck / Steam Machine without modifying the read-only system partition.
2. Select the installed screensaver under Settings → Customization; verify actual discovery and launch on the installed Stable client.
3. Disconnect networking; verify GIF, animated WebP and VP9 loops from real user-downloaded artworks, titles, credits, scene timing and both transitions.
4. Verify no distortion at 1280 × 800, 1920 × 1080 and a 4K output; measure GPU/CPU, memory and thermals over an extended library run.
5. Resume Steam using mouse, keyboard and controller; confirm immediate dismissal, released playback and no orphan process.
6. Verify Steam's in-game-disable/idle behavior, suspend/resume, client restart, repeated install/repair/uninstall and an interrupted update.

No physical SteamOS, Steam Deck or Steam Machine acceptance is claimed from a local browser or a successful file installation.
