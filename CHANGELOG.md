# Changelog

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
