# Source and redistribution review

## Original project

All code in `core`, `manager`, `player`, the Electron shell, tests and project scripts was written independently for this project. No code, artwork, tokens or private resource from `Alyenax/GabeCubeAura-Lab` was copied. That private repository has no declared license in its GitHub metadata; access permission was not treated as a redistribution license.

Original source and original test artwork are MIT licensed under the root LICENSE. No Valve or SteamGridDB trademark artwork is embedded. The product is an unofficial community project.

## Distributed executable components

The Linux x64 candidate contains Electron 44.7.2 (Electron's MIT license and bundled Chromium third-party notices remain in the distribution) plus separate FFmpeg and FFprobe executables downloaded from the pinned [ffmpeg-static b6.1.1 release](https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1). The tag name does **not** reliably identify the binary version: that release's Linux README identifies a John Van Sickle FFmpeg **7.0.2** build licensed GPLv3. Packaging preserves the exact upstream `FFmpeg.LICENSE`, `FFmpeg.README`, the source URL and hashes in `binaries/PROVENANCE.json`.

FFmpeg upstream and its compiled libraries retain their own licenses. These tools run as separate child processes. The MIT license on the original application does not replace or relicense those executables. Their build/source provenance is described by the [upstream packaging project](https://github.com/eugeneware/ffmpeg-static) and [John Van Sickle build site](https://johnvansickle.com/ffmpeg/).

**Public binary release gate:** reproduce or obtain the exact complete corresponding source and build materials for the distributed GPL binaries, retain all notices and satisfy the applicable distribution obligations before making a public binary release. A general link to the FFmpeg homepage is not being treated as a completed source-compliance package. The candidate stays private while this item is outstanding. Source code may be reviewed independently of third-party binary redistribution.

The npm macOS `ffmpeg-static` executable used locally reports FFmpeg 6.0 with `--enable-nonfree`. It is used for local development validation only and is not included in any released package. There is no macOS binary release. The Linux build downloads the separate Linux executables and does not reuse the macOS tools.

## Development dependencies

`package-lock.json` records exact npm package versions. Electron, Electron Packager, Playwright, and the npm wrappers around executable tools have their individual package notices/licenses. Development dependencies and their node_modules tree are not copied into the Linux application's code directory. The application itself uses Node built-ins at runtime; the media executables are found in `binaries/`.

## Artworks

SteamGridDB artists and game rights holders retain rights in their assets. Users download artwork locally under the service's terms; creator names and source attribution are retained. API access is not interpreted as a blanket redistribution license. No third-party game artwork appears in the released archive. QA captures use original labelled test animations and mocked search results; they do not prove a live authenticated API session.
