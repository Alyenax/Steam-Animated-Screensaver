# Source and redistribution review

## Original project

All code in `core`, `manager`, `player`, the Electron shell, tests and project scripts was written independently for this project. No code, artwork, tokens or private resource from `Alyenax/GabeCubeAura-Lab` was copied. That private repository has no declared license in its GitHub metadata; access permission was not treated as a redistribution license.

Original source and original test artwork are MIT licensed under the root LICENSE. No Valve or SteamGridDB trademark artwork is embedded. The product is an unofficial community project.

## Distributed executable components

The Linux x64 candidate contains Electron 44.7.2 (Electron's MIT license and bundled Chromium third-party notices remain in the distribution) plus separate FFmpeg and FFprobe executables downloaded from the pinned [ffmpeg-static b6.1.1 release](https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1). The tag name does **not** reliably identify the binary version: that release's Linux README identifies a John Van Sickle FFmpeg **7.0.2** build licensed GPLv3. Packaging preserves the exact upstream `FFmpeg.LICENSE`, `FFmpeg.README`, the source URL and hashes in `binaries/PROVENANCE.json`.

FFmpeg upstream and its compiled libraries retain their own licenses. These tools run as separate child processes. The MIT license on the original application does not replace or relicense those executables. Their build/source provenance is described by the [upstream packaging project](https://github.com/eugeneware/ffmpeg-static) and [John Van Sickle build site](https://johnvansickle.com/ffmpeg/).

**Public binary release gate:** reproduce or obtain the exact complete corresponding source and build materials for the distributed GPL binaries, retain all notices and satisfy the applicable distribution obligations before making a public binary release. A general link to the FFmpeg homepage is not being treated as a completed source-compliance package. The candidate stays private while this item is outstanding. Source code may be reviewed independently of third-party binary redistribution.

The npm macOS `ffmpeg-static` executable used locally reports FFmpeg 6.0 with `--enable-nonfree`. It is used for local development/fixture generation only and is not included in any released package. The Linux build downloads separate Linux executables and does not reuse the macOS development tools.

## macOS native media tools (0.1.7)

The Apple Silicon app builds separate FFmpeg / FFprobe executables from **FFmpeg 8.1.3**, with **libvpx 1.16.0** and **dav1d 1.5.4**. GPL, version3 and nonfree options are explicitly disabled; the resulting FFmpeg tools report LGPL 2.1-or-later. libvpx and dav1d use BSD licenses. The build disables network input and uses only macOS system dynamic libraries. No Homebrew installation, Intel executable or development `ffmpeg-static` binary is copied into the Mac app.

`binaries/` includes licenses, libvpx patent notice, binary/source digests and compiler/configuration provenance. Complete unmodified source archives and the exact Node build recipe are in `binaries/sources/`; `REBUILD.txt` describes prerequisites and replacement in a user's own app copy. pkgconf is a build-only tool whose source archive is also included. Meson 1.9.1 and Ninja 1.13.0 are isolated build dependencies, not shipped runtime dependencies. The FFmpeg release archive's signature was checked against the official release key (fingerprint FCF986EA15E6E293A5644F10B4322F04D67658D8) before pinning its digest. Upstream references: [FFmpeg](https://ffmpeg.org/download.html), [libvpx](https://github.com/webmproject/libvpx/tree/v1.16.0), [dav1d](https://github.com/videolan/dav1d/tree/1.5.4).

Electron's bundled license/Chromium notices are retained in the `.app`. Its local ad-hoc code signature checks bundle integrity; it does not provide Apple Developer identity or notarization. No such certificate/credentials are assumed.

## Development dependencies

`package-lock.json` records exact npm package versions. Electron, Electron Packager, Playwright, and the npm wrappers around executable tools have their individual package notices/licenses. Development dependencies and their node_modules tree are not copied into the Linux application's code directory. The application itself uses Node built-ins at runtime; the media executables are found in `binaries/`.

## Artworks

SteamGridDB artists and game rights holders retain rights in their assets. Users download artwork locally under the service's terms; creator names and source attribution are retained. API access is not interpreted as a blanket redistribution license. No third-party game artwork appears in the released archive. QA captures use original labelled test animations and mocked search results; they do not prove a live authenticated API session.
