# 0.1.10-rc.1 — Steam automatic-start settings

Add **Settings → Automatic start in Steam**. Choose plugged-in and battery delays, or Disabled. Quit Steam completely before applying, then reopen it in Big Picture with the custom screensaver selected.

Steam’s stable UI currently hides these controls on machines with a battery outside Gamescope. The same condition and configuration store were verified in Valve’s current macOS, Windows x64 and Linux packages before enabling the option across platforms. The app backs up config.vdf, preserves other settings and refuses writes while Steam runs or the file changes concurrently. OS screensaver/lock settings remain separate.

Validation: 127 automated tests, real controls in EN/FR, native macOS packaged-app tests and four-platform archive checks. Native automatic playback and physical keyboard interruption have been observed on Mac. Windows/Linux/SteamOS native acceptance remains pending; package inspection does not establish those runtime results.

Private development prerelease; no public 1.0 announcement. All four platform downloads are provided, with Mac DMG and ZIP. Existing data and exports are retained. The Mac app is ad-hoc signed and not notarized.
