# 0.1.3-rc.1 — Preview repairs, chosen fixed artwork and configurable 30 fps sizes

SteamGridDB sometimes supplies WebM videos as thumbnails. Search results, alternative galleries, library cards and preparation rows now display real locally generated JPEG previews. Missing thumbnails fall back to available source artwork; search results beyond the first eight resolve thumbnails on demand. Failed Home and detail media previews fall back to still images. These paths are verified in the actual UI, including live SteamGridDB results.

Choose a separate fixed artwork in **Library → Game details → Fixed artwork → Choose / change fixed artwork**. The choice is prepared immediately, credited separately, preserved through restart/preparation and exported without replacing the animation. **Use automatic artwork** restores automatic selection.

**Settings → Playback → Maximum size per 30 fps video (MB)** sets your own output ceiling. **0 means no per-video limit**, and is the default. The total library storage setting and available disk space still apply. Hidden 160 MiB output/temporary-frame limits and the interpolation timeout are removed. Originals remain available, and processing can still be paused/cancelled. A valid processed WebM above the former size ceiling is covered by regression testing.

The visible product name is now **SteamOS Animated Screensaver** everywhere. The unapproved Cinema brand and Local-first badge are removed.

## Update on the Steam Machine

1. In Desktop Mode, close the Manager, extract the Linux x64 package and run `./install.sh`. Existing catalog, key and media are preserved.
2. Choose your fixed artwork and desired size limit. Prepare again if you change the 30 fps processing settings, then inspect Preview.
3. Use **Update / repair** to republish the chosen artwork, player and settings to Steam. Restart Steam if it retains the old page.

This is a private installation candidate. Local browser/native Electron/decoder checks and live provider checks are recorded in VALIDATION.md and LIVE_PREVIEWS_VALIDATION.json. Physical Steam Machine/Gamescope behavior, including the previously reported error -105, still requires target-device confirmation. GitHub Actions remains disabled. No personal key or downloaded game artwork is included.
