# Security

Use a personal SteamGridDB API key. Optional owned-library import uses a separate personal Steam Web API key, also stored in a user-only local file and removable independently in Settings. Steam import calls only the fixed official API endpoint, with redirect rejection, a timeout and response-size bound. The key is stored locally with user-only permissions; it is not in player exports, screenshots, release files or normal state messages. Removing the application preserves your data by default. Erase the local data directory explicitly if you want the saved key removed.

Downloaded media is untrusted. The backend restricts source hosts and redirects, bounds bytes and decoder time, probes the actual stream, and spawns media tools with argument arrays. The player and manager do not evaluate artwork metadata as HTML. Only selected local files are served by the custom protocol. The application never reads Steam cookies/passwords or modifies manifests.

The packaged manager does not run a local HTTP server. Development's server binds to loopback and checks same-origin JSON and Host headers. Do not expose it on a network interface or reverse proxy.

Report vulnerabilities using a private GitHub security advisory when available. Do not include your API key or downloaded third-party artworks in public reports. This candidate is private while native Windows/Linux runtime, physical Steam acceptance and binary redistribution review are completed.

Complete media purge requires `confirm:true` in the validated main-frame IPC action. Its UI confirmation names the permanent cache deletion and Steam snapshot removal. It serializes against mutations, aborts active media/preview work and preflights cache directories and Steam ownership. It does not follow symlinks or recurse into unmarked directories. Keys and catalog choices are preserved. Deletion tests run only against temporary fixtures, never the development host's real Steam installation or application data.

Local diagnostic JSON never logs action payloads. Secret fields, known saved keys, bearer tokens and credential query parameters are redacted. Logs use private permissions, atomic commits and bounded rotation; they are never uploaded. Electron crash uploads are disabled. Native binary dumps can contain memory and should be reviewed before sharing. Media purge preserves diagnostics. A diagnostic write failure is exposed in Settings and leaves the prior valid JSON intact.
