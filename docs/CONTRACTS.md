# Contracts v1

CommonJS Node.js core; browser ES modules for Manager and Player. No code or assets copied from the private Lab. No automatic GitHub workflows.

## Core

`createCore({dataDir, steamRoots?, media?})` exported by `core/index.cjs` returns an object with async `invoke(action, payload={})` and `close()`. The Electron bridge exposes `window.screensaver.invoke(action,payload)` only. Development server uses POST /api/invoke {action,payload}, GET /api/state. Player/local media served under /media/<safe filename>. Core paths stay private to main process; state contains media filenames, never API key.

Actions: `state`, `scan`, `search` {query}, `add` {sgdbId,steamAppId?,name}, `updateGame` {id,included?,selectedAsset?,crop?}, `remove` {id}, `artworks` {id}, `covers` {id}, `setCover` {id,selectedCover:Asset|null}, `previewImage` {url?|file?|sgdbId?|steamAppId?,force?}, `prepare` {ids?}, `pause`, `resume`, `cancel`, `retry`, `settings` {language?,sceneDuration?,shuffle?,transition?,showLogos?,showCover?,coverPosition?,framing?,smoothMotion?,smoothingFps?,smoothingMode?,maxSmoothingMB?,staticFallback?,reducedMotion?,maxStorageGB?,pauseOnGame?}, `setKey` {key}, `setSteamAccount` {profile?,key?} (omitted key preserves; empty removes), `importSteamLibrary`, `validateKey`, `clearUnused`, `purgeMedia` {confirm:true}, `repair`, `install`, `uninstall`.

`state`: {version:1,games:[],settings:{language:'en',sceneDuration:24,shuffle:true,transition:'crossfade',showLogos:true,showCover:true,coverPosition:'beside-title',smoothMotion:false,maxSmoothingMB:0,staticFallback:false,reducedMotion:false,maxStorageGB:10,pauseOnGame:true},job:{status:'idle'|'running'|'paused'|'completed'|'cancelled',total:0,processed:0,current:null,stage:'',errors:[],bytes:0},steam:{detected:false,roots:[],installed:false},storage:{used:0},hasKey:false}.

Game: {id:'steam:123'|'sgdb:123',steamAppId:null|number,sgdbId:null|number,name,sources:['installed'|'manual'|'account'|'popular'],installed:boolean,included:true,status:'new'|'ready'|'missing'|'error',selectedAsset:null|Asset,manualSelection:false,media:null|{file,thumbnail,width,height,duration,format,animated,author,sourceUrl},error?:string}.

Asset: {id,url,thumb,width,height,score,kind:'hero'|'grid',animated:true|false,author:{name,steam64?},mime?,rank?,reasons?:[]}.
Search result: {sgdbId,steamAppId:null|number,name,thumb:null|string,present:boolean}.

Optional Game fields since 0.1.2: `cover:null|Media`, `smoothed:null|Media`, `coverError?:string`, `smoothingError?:string`. Since 0.1.3: `selectedCover:null|Asset`, `coverManualSelection:boolean`, `thumb:null|string`. Covers require `animated:false`; smoothed variants retain source metadata and `sha256`, with `smoothing:'interpolate-30-v1'|'native-30-plus'`. `coverPosition` is restricted to `beside-title|bottom-right|top-right|top-left`.

## Media and installer

`core/media.cjs`: `createMedia({dataDir,ffmpegPath?,ffprobePath?})` -> { async prepare(asset,{signal,onProgress,maxBytes?,requireStatic?}) => media (above), async validate(media)=>boolean, async smooth(media,{signal,maxBytes?,processMs?})=>Media, async preview({url?|file?},{signal,force?})=>{file} }. Downloader included here; only HTTPS SteamGridDB CDN URLs and validated redirects, bounded bytes/time. Source retained. Transcode incompatible inputs and explicitly requested smoothing variants. Thumbnail a safe basename. media directory: dataDir/media.

`core/installer.cjs`: exports async `install({dataDir,steamRoot,games,settings})`, `uninstall({steamRoot})`, `isInstalled(steamRoot)`. Copies player and included ready media into owned named screensaver folder; embedded `catalog.js` assigns `window.SAS_CATALOG={version:1,games:[{...game,media:{...media,file:'media/<filename>',thumbnail:'media/<filename>'}}],settings}`. Atomic replacement, ownership marker, no unrelated file changes. Never assumes Steam runtime validation from installing files.

## Player

player/index.html loads catalog.js then player.js. No server, fetch, API, Node, remote code or network needed. Exposes window.SteamAnimatedScreensaverPlayer with play(),pause(),next(),previous(),setSettings(partial),destroy(). Preview iframe uses same player; parent can postMessage({type:'screensaver',action:'catalog',catalog}), or controls play/pause/next/previous/settings. Catalog message maps media file paths to `/media/<filename>` in development or app protocol path in Electron. Player does not capture input in Steam runtime. Preview fullscreen owned by manager, Escape exits.

Since 0.1.4: settings `smoothingFps:24|30` (default 30), `smoothingMode:'fast'|'quality'|'blend'` (default fast, existing enabled users migrate to quality). `smoothed.smoothingConfig={fps,mode,codec,version:2}`; derivative cache identity and export/preview selection include this configuration. Native already-fluid media retains its original cadence. `smooth(media,{settings,onProgress,...})` reports `stage`, optional `progress:0..1|null`, frames/totalFrames, output seconds/duration, elapsed, speed and eta. Stage percentage is not whole-library percentage. `job` adds detail, stageStartedAt, and a 250-entry history; public running state adds stageElapsed. Steam account state is `{profile,steamId,hasKey,lastImport,count,added?}`. The account API provider is injectable for tests; the actual packaged implementation calls Valve directly and never exposes keys.

Since 0.1.5: `purgeMedia {confirm:true}` clears the managed media cache and owned current/legacy Steam snapshots, cancels unfinished preparation/preview work, and resets scene media/status and the queue. It preserves game identities/inclusion, selectedAsset/manualSelection, selectedCover/coverManualSelection, settings, Steam-account metadata and both keys. Public/persisted state adds `previewsPaused:boolean` and optional `lastMediaPurge:{at,files,bytes}`. Explicit search/artwork galleries/preparation resume preview downloads. No-confirm calls fail before filesystem changes. A failed preflight preserves media; a failed deletion leaves a retryable unprepared catalog. `core/purge.cjs` performs a scoped filesystem plan/apply operation; `installer.assertCanUninstall(root)` preflights the owned destination without mutation.

Since 0.1.6: `settings.framing: original|16:9|16:10` (default original); optional `Game.crop: {mode:inherit|original|16:9|16:10,x:number,y:number}`. Coordinates must be finite and within 0..100. `updateGame {id,crop}` persists display-only changes without invalidating media. Duplicate merges, restart and media purge preserve crop preferences. The installer includes crop in each exported game and framing in playback settings.

`core/steam-components.cjs` identifies Steam infrastructure using known runtime/redistributable AppIDs and bounded names. Scanner, account import, SGDB search/add, startup catalog migration and export omit those entries. Startup migration also removes pending queue references. Steam manifests, installed components and cached media are never deleted by filtering. Runtime AppID reference: https://github.com/ValveSoftware/steam-runtime/blob/master/doc/reporting-steamlinuxruntime-bugs.md .

## 0.1.8 selection and diagnostics

Actions: `setIncluded {filter?,query?,included:boolean}`, `selectLibraryTop {filter?,query?,criterion:'steam'|'playtime'}`, `importPopular`, `cancelSelection`, `diagnosticsEvent {event,message,stack?,source?,line?,gameId?}`. Native-shell `openLogs` opens only the current known local journal; it takes no caller-supplied path.

`selectionJob` is volatile `{status,kind,processed,total,current?,selected?,added?,rankedAt?,error?}`. Selections/catalog changes persist only after the full validated provider result. `playtimeMinutes` and `popularRank` are optional Game fields. Unknown personal playtimes require reimport. Ranking uses owned games in the current UI filter/search scope and leaves outside/manual-only games untouched. New global imports are excluded. Public counts are cached for 30 min in `steam-popularity.json`.

Core exposes diagnostic availability, the explicit journal path and any write failure. `logs/diagnostics.json` is schemaVersion 1, with session/part/version/system, `cleanExit`, timestamps and structured events. Four prior segments are retained, at most 4 MiB each. Sync/rename commits preserve valid JSON on abrupt exit. IPC/action payloads are not logged; known credentials, secret fields, bearer tokens and key query parameters are redacted. Historical data/export/marker/environment aliases are retained only for migration.

## App updates since 1.2.0

Electron main owns a separate updater and fixed-argument platform installer. `state.appUpdate` exposes only public status (current/available version, phase, progress, bytes, total, preferences, timestamps, escaped release text and capability/error codes). It never exposes signing keys or helper transaction paths. Main-frame IPC adds `appUpdateCheck`, `appUpdateDownload`, `appUpdateCancel`, `appUpdatePreferences` {autoCheck:boolean}, `appUpdateInstall` {confirm:true} and `appUpdateRelease` (fixed official URL; caller-supplied URLs are ignored). The browser development core reports updates unavailable unless an isolated test adapter is explicitly supplied.

The Ed25519-signed `update.json` envelope carries schema/key identity, base64 payload and signature. Its payload binds stable version/tag and exactly four platform assets with expected names, compressed and expanded sizes and SHA-256. Runtime validates against `core/update-key.cjs`. Transaction files and the catalog snapshot live in `dataDir/updates/transactions/<nonce>/`; app staging and previous app backups are siblings of the active installation on the same filesystem. Prepared media and credentials are never part of a release or an app replacement.
