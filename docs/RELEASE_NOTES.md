# 0.1.0-rc.1 — private installation candidate

SteamOS Animated Screensaver is a standalone manager and offline Steam screensaver player. It scans installed games, supports manual SteamGridDB discovery with a personal key, prepares animated artwork incrementally, and installs an owned local player snapshot. Electron/Node powers the manager; the exported HTML player needs neither the manager nor a service.

The candidate includes EN/FR interfaces, a responsive animated gallery, alternate-artwork selection, real preparation progress, pause/resume/cancel/retry, source-preserving GIF/WebP/WebM processing, same-engine preview and user-space Linux x64 installation/update/removal scripts.

Executed validation includes Node tests, real FFmpeg decoding/conversion, actual Chromium and native macOS Electron playback, responsive interaction checks and an independent UX review. Live SteamGridDB tests successfully searched and added Portal 2 and Cyberpunk 2077, prepared real animated Heroes, then played both from exported local files with the manager closed and zero network requests. The temporary key, downloaded artwork and live screenshots were removed. See docs/VALIDATION.md and docs/LIVE_VALIDATION.json for exact scope.

This is a **Linux x64 installation candidate**, built locally on macOS arm64. It has not been executed on Linux, Steam Deck, Steam Machine or Steam's Gaming Mode/CEF. Controller dismissal, GPU/CPU/memory/energy use and long-duration target-device playback remain pending. No Windows or macOS release compatibility is advertised.

Original source is MIT licensed and independent of the private GabeCubeAura Lab. No downloaded artworks, secrets, or private code are distributed. The archive includes separate GPL FFmpeg executables and their upstream notices/provenance. Complete corresponding-source redistribution review remains a public-binary-release gate; the repository and release stay private.

Download the tar archive and SHA256SUMS together, verify the checksum, extract, then run install.sh in Desktop Mode. No compilation, root installation, SteamOS read-only-mode change or global dependency installation is performed. See docs/INSTALLATION.md for prerequisites, setup, updates, removal and recovery.

GitHub Actions is disabled and no workflows were added or triggered.

Not affiliated with or endorsed by Valve or SteamGridDB.
