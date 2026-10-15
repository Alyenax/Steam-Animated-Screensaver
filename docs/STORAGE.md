# Catalog, cache and ranking

## Local data

On Linux, the default application data directory is `~/.config/steamos-animated-screensaver` (Electron's app-data root respects the platform configuration). macOS development uses `~/Library/Application Support/steamos-animated-screensaver`. `CINEMA_DATA_DIR` selects an absolute isolated directory for development/QA; `npm run dev` otherwise uses the repository's ignored `.data` directory.

- `catalog.json`: versioned game identities, settings, preparation queue and measured media metadata. Atomic temporary-write/rename; user-only permissions.
- `steamgriddb.key`: personal key, user-only permissions. Never exported to the player.
- `.manager.lock`: exclusive writer lock with process identity.
- `media/`: content-named originals, any necessary compatible output and generated thumbnails. Partial work is not marked ready.

The catalog stores Steam AppIDs separately from SteamGridDB IDs, source provenance, installed status, inclusion, explicit artwork selection, credits and processing status. Scanning never deletes a manual game or completed media. Artist metadata is escaped at render time. Removal from Cinema does not remove the Steam installation; unused local media can subsequently be cleared explicitly.

No media is redistributed by the source repository or release. The installed Steam snapshot copies only ready included playback files and thumbnails, with credits and playback settings; it does not copy keys, original download URLs, queue state or management APIs.

The cache ceiling counts sources, derived playback files and thumbnails. Preparation preflights remaining configured space and free disk, and passes a byte budget through download and output validation. It cannot reserve storage against other processes writing concurrently. Installed copies and the application package occupy additional disk space outside the cache meter.

## Deterministic selection

For at most 100 candidates per requested asset type/filter, score:

`1000 animated + 150 Hero + 50 landscape + aspect closeness (0–20) + resolution (0–20) + log vote score (0–15)`.

Ties use type then numeric artwork ID. Animated assets always outrank still fallbacks. An animated landscape Hero outranks a portrait Grid even when the Grid has more votes. The API filters out NSFW, humor and epilepsy-tagged media. An API content label is not an independent content audit.

These weights reflect known metadata, not an invented aesthetic measurement. Candidate codec, duration and true frame count are verified by the media engine; automatic preparation tries at most the first three ranked candidates when a download or validation fails, recording rejection reasons. Manual selection attempts only the selected artwork and never substitutes silently. Artistic loop continuity, black-ending detection, logo presence, smoothness and subjective composition are not scored in this version. Original artwork is never modified to conceal an assumed artistic flaw; optional interpolation creates a separate explicitly requested derivative. Use the alternate-artwork gallery when automatic selection is unsuitable. An explicit manual choice is not overwritten by automatic matching.

## Optional derivatives

`cover` stores independently validated static portrait Grid media and author credit. Candidates use the official static Grid filter, portrait dimensions 600×900 or 342×482, the same content exclusions, votes descending, then resolution and ID. Up to three candidates are attempted. Covers do not enable the full-screen static fallback setting. Existing ready animations need no download when adding a missing cover.

`smoothed` stores an optional 30 fps VP9 derivative keyed to the original source SHA-256. Its original, thumbnail and both playback variants remain referenced through unused-media cleanup. `coverError` and `smoothingError` record optional failures without marking an otherwise playable animation broken. Core state retains these fields across restart. Export selects one playback variant plus the cover and thumbnail; source URLs and processing errors stay in the Manager.

## Work scheduling

One preparation worker runs at a time. Finished files are reused after validation. Pause/cancel abort current downloads/decoding, checkpoint the queue and retain finished work. `/proc` Steam game environment detection can pause preparation on Linux; it is best effort, ignores the manager's descendants and is not an idle/screensaver controller. The application does not capture game input or read account session tokens.

During playback the manager is unnecessary. The player has one active media scene and at most two decoders during transitions. See PLAYER.md for the exact measured formats and unverified Steam CEF behavior.
