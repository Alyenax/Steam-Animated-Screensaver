# 0.1.9-rc.1 — Animation selection and direct startup

**Library → Game details → Change animation** is now at the top of the game sheet, above the preview, crop and fixed artwork. Games without prepared media show **Find animations**. The alternatives open directly in view. The button remains available after empty results or an error so the search can be retried.

Choose an animation, then **Prepare this game**. Browsing alternatives preserves the current media; selecting/preparing replaces the animation and retains the fixed artwork, crop and inclusion. Use **Update / Repair** afterward to apply it to the installed Steam screensaver.

The player no longer displays an introductory/empty-library screen while loading a valid catalog or its first media. The first decoded image appears directly, without an introductory fade. Normal transitions between scenes and actual unavailable-media messages remain. The regression test deliberately delays the catalog and animation in English and French and checks every rendered frame for an intro flash.

**After updating the app, use Settings → Steam integration → Update / Repair**, then restart Steam if it keeps the previous page. An existing Steam snapshot is independent of the app and does not receive code changes until updated.

All four platform downloads are supplied: SteamOS/Linux x64, Windows x64 and macOS Apple Silicon DMG/ZIP. Native Mac and automated software checks are recorded separately from native Windows/Linux/SteamOS and actual Steam idle/wake acceptance, which remain pending. Private candidate; no credentials or game artwork included; GitHub Actions stays disabled.
