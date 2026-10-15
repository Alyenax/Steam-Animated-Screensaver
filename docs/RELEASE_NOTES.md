# 0.1.1-rc.1 — Steam screensaver identifier correction

The user reported error -105 when previewing the 0.1.0 screensaver and when its one-minute idle timeout elapsed on a Steam Machine in Gamescope. Inspection of the extracted Steam frontend confirmed that custom players load through a virtual HTTPS hostname, whereas our first tests had primarily exercised file:// playback.

The installer now uses the lowercase DNS-safe directory `steamos-animated-screensaver`, separately from the product title. It stages and commits a complete replacement before removing an owned legacy export. Migration failure preserves prior files; unowned folders remain untouched. A small `repair-steam-screensaver.sh` can rename an existing owned export without downloading artwork again.

After repair, fully restart Steam and reselect **steamos-animated-screensaver** under Settings → Customization. Verify Preview and automatic activation after the configured idle timeout. Update the Manager to 0.1.1 before its next install/update action, because 0.1.0 would recreate the old name.

The new software checks cover DNS-safe identifiers, owned migration/uninstall, failed migration preservation, repeatable repair, and playback from the actual export under a locally mapped HTTPS steamscreensavers.host test origin. This emulates the origin boundary, not Steam's C++ domain mapper or Gamescope. Physical confirmation of the fix is still required; the exact failed URL from the affected client has not been collected.

The prior live SteamGridDB preparation and offline playback checks on Portal 2 and Cyberpunk 2077 remain documented. No temporary key or downloaded game artwork is distributed. The repository/release remain private pending target-device acceptance and corresponding-source redistribution review for the separate GPL media executables. No GitHub Actions workflow is present or triggered.

The Linux x64 package includes the updated Manager, player installer, repair script, documentation and FFmpeg/FFprobe. The source archive and checksum files are supplied separately. Not affiliated with or endorsed by Valve or SteamGridDB.
