# Security

Use a personal SteamGridDB API key. The key is stored locally with user-only permissions; it is not in player exports, screenshots, release files or normal state messages. Removing the application preserves your data by default. Erase the local data directory explicitly if you want the saved key removed.

Downloaded media is untrusted. The backend restricts source hosts and redirects, bounds bytes and decoder time, probes the actual stream, and spawns media tools with argument arrays. The player and manager do not evaluate artwork metadata as HTML. Only selected local files are served by the custom protocol. The application never reads Steam cookies/passwords or modifies manifests.

The packaged manager does not run a local HTTP server. Development's server binds to loopback and checks same-origin JSON and Host headers. Do not expose it on a network interface or reverse proxy.

Report vulnerabilities using a private GitHub security advisory when available. Do not include your API key or downloaded third-party artworks in public reports. This candidate is private while Linux runtime, physical SteamOS acceptance and binary redistribution review are completed.
