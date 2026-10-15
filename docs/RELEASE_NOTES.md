# 0.1.2-rc.1 — Fixed covers, placement and optional smoothing

A static game cover can now appear beside the title, bottom right, top right or top left, using the same margins as the title. Change its position or visibility from Preview or Settings. Preparation caches a static portrait SteamGridDB Grid with artist credit; existing local thumbnails provide an offline fallback.

Optional **Smooth animations · 30 fps** prepares low-frame-rate GIF, WebP and WebM animations as separate silent VP9 videos, up to 1080p. Original bytes are retained; disabling the option restores original playback without downloading again. Already fluid media keeps its frame rate. Interpolation may distort movement, takes additional preparation/storage and cannot fix a broken loop. Bounded failures remain visible and retain the original animation.

## Apply the update

1. In SteamOS Desktop Mode, close the Manager, extract the Linux x64 package and run `./install.sh`. Existing catalog, key and media are preserved.
2. In Settings, choose the cover position and optionally enable smoothing. Prepare the library to fetch covers/process selected animations.
3. Inspect Preview, then choose **Update / repair** to copy the new player, settings and selected media into Steam. Restart Steam if it retains the previous page.

The “Your library. Beautifully alive.” promotional sentence and its French equivalent are removed from every scene. The standalone `remove-screensaver-tagline.sh` is also supplied for users who only want to hide that sentence in existing owned installations, with a CSS backup and no media preparation. That script alone does not add covers or smoothing.

The DNS-safe installation identifier and owned legacy migration from 0.1.1 are preserved. The repository/release stays private, GitHub Actions remains disabled, and no downloaded game artworks or secrets are distributed. Local software/browser/FFmpeg checks are recorded in VALIDATION.md. The reported Steam Machine error -105 still requires physical re-test; this package is an installation candidate.
