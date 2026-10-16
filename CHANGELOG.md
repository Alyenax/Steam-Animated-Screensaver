# Changelog

## 0.1.8 — Platform packages, library selection and diagnostics

- Rename app, repository, branch, package identifiers and downloads to Steam Animated Screensaver; migrate existing data and owned exports. Replace promotional copy with functional labels in EN/FR.
- Add filtered select/deselect all, owned top 100 by concurrent Steam players or personal playtime, and current Steam top-100 discovery. Progress/cancellation and provider failures preserve previous inclusion choices.
- Package SteamOS/Linux x64, portable Windows x64 and macOS Apple Silicon DMG/ZIP; detect platform Steam roots, including the Windows registry, and install the same Big Picture/Gaming Mode player.
- Save local diagnostic JSON with atomic commits, rotation, secret redaction, action/preparation errors, renderer exceptions and crash details. Add a Settings shortcut; keep native dumps local with uploads disabled.
- Add migration, ranking, logging, fault-injection, restart/recovery and packaged-app regression checks. Record native macOS execution separately from cross-platform package checks.

## 0.1.7 — Native macOS preview app

- Package the same Manager/Core/Player as an Apple Silicon `.app`, ZIP and drag-to-Applications DMG for macOS 13+. No Node, Homebrew, Rosetta or local server is required.
- Bundle native FFmpeg / FFprobe built from pinned sources with LGPL/BSD libraries, software AV1 decoding and complete source/rebuild materials. Keep development nonfree and Intel binaries out of the app.
- Include the existing product icon, stable bundle identity, ad-hoc signature and explicit notarization/SteamOS acceptance scope. Preserve app data across replacement.
- Exercise the distributed `.app` through actual image-preview generation, new 24 fps preparation, local animation playback/pause, framing and renderer isolation.

## 0.1.6 — Steam components and adjustable framing

- Filter Proton versions/runtimes, Steam Linux Runtime and Steamworks Common Redistributables from scans, owned-library import, search, manual addition and offline exports. Remove old catalog entries at startup while preserving installed Steam files and cached media.
- Preserve genuine similarly named games with bounded component-name patterns and known Steam runtime AppIDs.
- Keep Original framing as default; add true 16:9 / 16:10 frames globally and per game, with horizontal/vertical focal positions and Center controls. Disable axes that cannot change the selected crop.
- Apply framing immediately in Preview and persist it through restart, catalog merges, media purge and offline Steam export. No media re-encoding or additional preparation is required; Update / repair applies the saved snapshot.
- Verify exact frame ratios, focal-position rendering, responsive French controls, original-media preservation and native Electron playback.

## 0.1.5 — Complete media purge

- Add Settings → Local storage → Purge all media, with an explicit confirmation describing removal of the Steam snapshot and preservation of games, artwork choices, settings and keys.
- Stop active preparation and preview requests, remove originals/derivatives/covers/previews and owned unfinished-frame work, reset preparation state and uninstall owned current/legacy Steam exports.
- Keep previews paused after purge and restart until an explicit artwork search/gallery or preparation. Clear renderer preview promises and prevent late requests from recreating deleted files.
- Preflight cache/Steam ownership, reject links and unknown directories, retain unrelated files, and allow retry after partial deletion errors.
- Validate cancel/confirm, cache-empty navigation/restart, and preparation/reinstall with retained artwork choices.

## 0.1.4 — Live preparation details, lighter smoothing and optional Steam library import

- Show actual FFmpeg percentages, frames, elapsed time, speed and estimated remaining time; distinguish WebP reconstruction, interpolation/encoding, verification and saving. Keep a dated bounded preparation journal across restart.
- Choose 24 or 30 fps and Fast (720p VP8 motion interpolation), Quality (1080p VP9) or Very light (720p VP8 frame blending). Retain manual output limits, original files and profile-aware cache/export selection.
- Add optional direct Steam owned-library import using a locally stored personal Steam API key and SteamID/profile URL, without any hosted service. Merge by AppID, preserve selections, and filter non-installed/account games.
- Verify real intermediate UI progress, pause/cancel cleanup, 24 fps resume, offline playback and sample processing times. Live personal Steam-account validation remains pending.

## 0.1.3 — Preview repairs, chosen fixed artwork and configurable video sizes

- Reproduce and repair live SteamGridDB WebM thumbnails incorrectly rendered as images; generate cached JPEGs for search, library, queues and alternative/fixed-artwork galleries.
- Load missing game previews on demand beyond the first eight search results. Recover broken thumbnails from their source; Home/detail moving-preview failures fall back to a still image.
- Choose and replace fixed artwork independently of the animation, retain the manual choice through preparation/restart, and restore automatic selection.
- Add a manual output-size limit in MB; 0 defaults to no per-video limit. Remove hidden 160 MiB output/temporary-frame caps and interpolation deadline. Stream large-file headers/hashes and validate processed video above the former ceiling.
- Use Steam Animated Screensaver as the full product name in all visible UI and remove the Local-first badge.
- Validate actual live search/alternative/cover previews and offline playback of independently selected assets; keep secrets and downloaded artwork out of releases.

## 0.1.2 — Still covers and optional motion interpolation

- Download and validate a separate still portrait Grid, with local frame fallback and creator credit.
- Choose beside-title, bottom-right, top-right or top-left placement, sharing title margins; toggle covers independently.
- Optionally interpolate low-frame-rate GIF/WebP/WebM into offline 30 fps VP9, up to 1080p. Preserve originals and cache variants; show optional failures and allow switching back without downloading again.
- Composite WebP alpha/delta/disposal frames before interpolation; bound temporary storage and processing time.
- Remove the promotional sentence above each animation in English and French.
- Preserve game title controls, artist credits and original artwork.
- Provide a small backed-up CSS patch for existing owned Manager and Steam exports; no artwork download or preparation needed.

## 0.1.1 — Steam virtual-host identifier correction

- Replace the display-name installation directory with a lowercase DNS-safe identifier for Steam's HTTPS screensaver host mapping.
- Migrate only owned 0.1.0 exports after successful replacement; preserve files if staging fails.
- Supply a small repair script to rename an existing export without preparing or downloading media again.
- Add migration/repair regression coverage and actual playback under a mapped HTTPS test origin.
- Track the user's failed 0.1.0 Steam Machine Preview/idle acceptance separately from passing local tests; physical confirmation of this correction is pending.

## 0.1.0 — private installation candidate

- Independent Steam library scanner, unified installed/manual catalog and personal-key SteamGridDB integration.
- Recoverable, incremental media preparation with offline cache and explicit artwork selection.
- Bilingual animated manager, same-engine preview and local Steam screensaver export.
- User-space Linux x64 portable package, owned installation and removal scripts.

Target-device acceptance and outstanding limitations are tracked in docs/VALIDATION.md. This version is not advertised as physically validated on SteamOS.
