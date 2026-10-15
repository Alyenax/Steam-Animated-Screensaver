# Changelog

## 0.1.3 — Preview repairs, chosen fixed artwork and configurable video sizes

- Reproduce and repair live SteamGridDB WebM thumbnails incorrectly rendered as images; generate cached JPEGs for search, library, queues and alternative/fixed-artwork galleries.
- Load missing game previews on demand beyond the first eight search results. Recover broken thumbnails from their source; Home/detail moving-preview failures fall back to a still image.
- Choose and replace fixed artwork independently of the animation, retain the manual choice through preparation/restart, and restore automatic selection.
- Add a manual output-size limit in MB; 0 defaults to no per-video limit. Remove hidden 160 MiB output/temporary-frame caps and interpolation deadline. Stream large-file headers/hashes and validate processed video above the former ceiling.
- Use SteamOS Animated Screensaver as the full product name in all visible UI and remove the Local-first badge.
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
- Bilingual cinematic manager, same-engine preview and local Steam screensaver export.
- User-space Linux x64 portable package, owned installation and removal scripts.

Target-device acceptance and outstanding limitations are tracked in docs/VALIDATION.md. This version is not advertised as physically validated on SteamOS.
