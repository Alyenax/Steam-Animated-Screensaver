# Steam Machine error -105 - installation identifier correction

## Report and evidence

On 2026-10-15 the user reported Steam's error -105 on a Steam Machine in Gamescope, both when previewing the selected custom screensaver and when its one-minute idle timeout elapsed. This is a failed physical acceptance result for 0.1.0-rc.1, rather than an artwork preparation or API failure.

Chromium defines [-105 as NAME_NOT_RESOLVED](https://chromium.googlesource.com/chromium/src/+/main/net/base/net_error_list.h). It does not by itself establish that the user's Internet connection is down.

The extracted Steam frontend at [SteamTracking commit 7d81b2c](https://github.com/SteamDatabase/SteamTracking/blob/7d81b2cb9cdbf4f803ec7d2726922e71766a8dd8/ClientExtracted/steamui/sp.js) obtains custom screensavers from `Screensaver.GetLocalScreensavers`, uses the returned `path` as a virtual hostname, then loads `https://<returned-host>/index.html` in a domain-mapped BrowserView. Built-ins use `steamscreensavers.host` hostnames. This is more specific than the earlier file:// browser tests.

The 0.1.0 installer incorrectly used the product display name, including spaces and capitals, as its directory identifier: `Steam Animated Screensaver`. The referenced [tabs-screensavers example](https://github.com/Acerocks22/tabs-screensavers) uses a simple `windowspipes` identifier. Spaces are invalid in a DNS label and can interfere with Steam's domain mapping. The new identifier is the lowercase DNS-safe `steam-animated-screensaver`; the product title inside the player and manager is unchanged.

This corrects an actual identifier assumption. It is a plausible explanation for the reported DNS error, but the exact failing hostname has not been collected from the affected Steam client. A successful physical re-test is required before identifying it conclusively as the cause of that user's -105.

## Repair without downloading artwork again

From Desktop Mode, run the released `repair-steam-screensaver.sh`:

```sh
sh repair-steam-screensaver.sh
```

For a nonstandard Steam location, pass that root as its sole argument. The script only renames an owned legacy export and leaves its files intact. It refuses conflicting targets, unowned folders and unsafe configuration symlinks. It does not read the personal API key, alter Steam's selector settings, restart Steam, or install anything globally.

Fully restart Steam afterward and select **steam-animated-screensaver** in **Settings → Customization**. Test the Preview button, then allow the configured one-minute idle timeout to elapse. The previous selection may refer to the old identifier and must be selected again.

Update the Manager to 0.1.1 before its next Install/Update operation; version 0.1.0 would recreate the old directory name. Manager 0.1.1 automatically stages and commits the corrected export before removing an owned legacy export. Failed staging preserves the old files. Uninstall recognizes both owned identifiers, preserving unrelated screensavers.

## Software verification

- DNS-label and URL-construction regression for the corrected identifier.
- Owned legacy migration, failed migration preserving prior data, unowned-folder preservation and legacy uninstall.
- Standalone repair script rename, byte-identical preserved catalog and repeatable invocation.
- A new Chromium regression opens the actual installer export under a locally mapped HTTPS `*.steamscreensavers.host` test origin, verifies all local scripts/CSS/media load and actual video time advances, with no requests to other origins. Its TLS certificate and DNS mapping exist only in the isolated test; no device/browser settings are changed.

The HTTPS test emulates the host/origin boundary. It does not emulate Steam's native domain-mapping implementation, Gamescope or its CEF build. The pending physical Preview/idle tests remain explicit.
