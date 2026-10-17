# Third-party components and source

## Original project

Original application code is copyright 2026 Alyenax and licensed under the GNU General Public License, version 3 only (GPL-3.0-only); see the root LICENSE and NOTICE. The application is an unofficial community project, unaffiliated with Valve or SteamGridDB. Third-party components retain their own licenses.

Copies previously distributed under MIT retain their rights. This licensing change is not retroactive. The original MIT notice and terms for pre-existing portions are preserved in [licenses/MIT-previous.txt](../licenses/MIT-previous.txt).

## Electron

Every platform package retains Electron's LICENSE and Chromium third-party notices. Electron is pinned in `package-lock.json`. The application uses Node built-ins and a small set of production archive-reader dependencies at runtime. Development dependencies and the media-tool npm packages are not shipped.

## Archive readers

App updates use pinned `yauzl` (MIT) and `tar-stream` (MIT), with their runtime dependencies. Packages and original license notices are retained under the app’s `node_modules` directory. They are used to inspect and extract the signed Windows and Linux app downloads with additional path, link, size and entry-count restrictions. The lockfile records exact dependency versions.

## Media tools in version 1.0.0

FFmpeg and FFprobe run as separate executable processes. Every platform package includes their full LGPL 2.1-or-later license, source archives, source checksums, build configuration and exact build recipe under `resources/app/binaries` or the macOS app's `Contents/Resources/app/binaries`.

All current media tools use FFmpeg 8.1.3 with libvpx 1.16.0 and dav1d 1.5.4. GPL, nonfree and version3 configuration options are disabled. libvpx and dav1d use BSD licenses; the libvpx patent notice is retained. The original app's license does not relicense these components.

- macOS Apple Silicon tools are built natively by `scripts/build-media-macos.cjs`, with macOS 13 as the deployment target. They use only macOS system dynamic libraries. Their complete unmodified sources, including the build-only pkgconf source, accompany the binaries.
- Linux and SteamOS x64 tools are built locally by `scripts/build-media-cross.cjs`, using pinned Zig 0.15.2 and NASM 2.16.03. They are statically linked with musl. Zlib 1.3.1 source and notices, musl notices and the Zig runtime source archive are included.
- Windows x64 tools use the same local cross-build recipe, FFmpeg and codec sources. Zlib and the MinGW runtime notices and source are included. The Windows package is portable and does not require a separate FFmpeg installation.

`binaries/PROVENANCE.json` records the target, exact source digests and executable digests. `binaries/REBUILD.txt` describes rebuilding and replacing the tools in a user's own copy. Modifying and replacing these separate executables is permitted under their licenses. The application does not impose a DRM or signature restriction on replacement. On macOS, a changed personal app copy can be ad-hoc signed again.

Build-only prerequisites, including the compiler, Python, Meson and Ninja, are not shipped executable application dependencies. The recipes pin the downloaded build inputs. The Zig source archive also supplies the runtime source used by its cross compiler.

Earlier private test builds used upstream Linux GPL or Windows LGPL binaries without a completed corresponding-source bundle. Those development releases are retained as unpublished drafts. Version 1.0.0 replaces those media tools rather than publicly distributing the old candidates.

The npm macOS `ffmpeg-static` binary used to generate local test fixtures reports a nonfree configuration. It remains a development-only tool and is never copied into the platform downloads.

## Signing

The macOS app has an ad-hoc signature and is not Apple notarized. Windows is unsigned. This status is disclosed in the installation guide. No signing certificate or paid account is assumed.

## Artwork and music

SteamGridDB artists and game rights holders retain rights in their assets. Users download artwork separately; a personal API key is not a blanket redistribution license. No raw game artwork, personal library or API key is bundled in the applications.

The README, GIF and demonstration videos show actual app captures with game artwork. The files are presentation material, not reusable artwork under the app's license. Artist names, sources and capture scope are listed in [visual credits](../screenshots/public/CREDITS.md).

The videos use Song Of The Forge by Scott Buckley under CC BY 4.0. The track is excerpted, level-matched and faded. Keep the [music credit, source and license](../launch/MUSIC.md) with each video upload. The music license does not cover the depicted game artwork.
