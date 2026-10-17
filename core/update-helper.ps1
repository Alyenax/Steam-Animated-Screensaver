# Independent Windows replacement helper. Invoked with -File, never -Command.
param([Parameter(Mandatory=$true)][string]$Transaction)
$ErrorActionPreference = 'Stop'
$tx = Get-Content -LiteralPath (Join-Path $Transaction 'transaction.json') -Raw | ConvertFrom-Json
if ($tx.schema -ne 1 -or $tx.token -notmatch '^[a-f0-9]{32}$' -or $tx.target -ne 'win32-x64') { throw 'Invalid update transaction' }
foreach ($p in @($Transaction,$tx.active,$tx.staged,$tx.backup,$tx.dataDir)) {
  if (-not [IO.Path]::IsPathRooted($p)) { throw 'Invalid update path' }
  if ((Test-Path -LiteralPath $p) -and ((Get-Item -LiteralPath $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Update paths cannot be reparse points' }
}
if ($tx.active -eq $tx.backup -or $tx.active -eq $tx.staged -or (Split-Path -Parent $tx.backup) -ne (Split-Path -Parent $tx.active)) { throw 'Invalid replacement paths' }
if (Test-Path -LiteralPath (Join-Path $Transaction 'result.json')) {
  $completed = Get-Content -LiteralPath (Join-Path $Transaction 'result.json') -Raw | ConvertFrom-Json
  if ($completed.phase -in @('updated','rolled_back')) { exit 0 }
}
$lock = Join-Path $Transaction 'helper.lock'
if (Test-Path -LiteralPath $lock) {
  if ((Get-Item -LiteralPath $lock -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Invalid helper lock' }
  $previous = 0
  if (Test-Path -LiteralPath (Join-Path $Transaction 'helper.pid')) { $previous = [int](Get-Content -LiteralPath (Join-Path $Transaction 'helper.pid') -Raw) }
  if ($previous -gt 0 -and (Get-Process -Id $previous -ErrorAction SilentlyContinue)) { throw 'Another update helper is active' }
  Remove-Item -LiteralPath $lock -Force -ErrorAction Stop
}
New-Item -ItemType Directory -Path $lock -ErrorAction Stop | Out-Null
[IO.File]::WriteAllText((Join-Path $Transaction 'helper.pid'),[string]$PID)
function Result($phase,$message) {
  $value = @{phase=$phase;error=$message} | ConvertTo-Json -Compress
  [IO.File]::WriteAllText((Join-Path $Transaction 'result.tmp'),$value,[Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath (Join-Path $Transaction 'result.tmp') -Destination (Join-Path $Transaction 'result.json') -Force
}
function Move-Retry($source,$destination) {
  for ($attempt=0; $attempt -lt 40; $attempt++) {
    try { Move-Item -LiteralPath $source -Destination $destination -ErrorAction Stop; return }
    catch { if ($attempt -eq 39) { throw }; Start-Sleep -Milliseconds 250 }
  }
}
function Launch-App {
  $env:SAS_DATA_DIR = $tx.dataDir
  $env:SAS_UPDATE_TOKEN = $tx.token
  $env:SAS_UPDATE_HEALTH = Join-Path $Transaction 'health'
  Start-Process -FilePath (Join-Path $tx.active $tx.executable) -WorkingDirectory $tx.active -PassThru
}
$newProcess = $null
$moved = $false
$swapStarted = $false
try {
  $deadline = [DateTime]::UtcNow.AddSeconds(120)
  while (Get-Process -Id $tx.parentPid -ErrorAction SilentlyContinue) {
    if ([DateTime]::UtcNow -ge $deadline) { throw 'The application did not close' }
    Start-Sleep -Milliseconds 250
  }
  if (-not (Test-Path -LiteralPath $tx.active) -and (Test-Path -LiteralPath $tx.backup)) {
    Move-Retry $tx.backup $tx.active
    Result 'rolled_back' 'An interrupted replacement was recovered.'
    $null = Launch-App
    exit 0
  }
  if (-not (Test-Path -LiteralPath $tx.active) -or -not (Test-Path -LiteralPath $tx.staged) -or (Test-Path -LiteralPath $tx.backup)) { throw 'Application paths changed' }
  if ((Get-Content -LiteralPath (Join-Path (Split-Path -Parent $tx.staged) '.sas-update-token') -Raw).Trim() -ne $tx.token) { throw 'Invalid staged application' }
  $actual = @(Get-ChildItem -LiteralPath $tx.active -Force | ForEach-Object {$_.Name})
  if ($actual.Count -ne $tx.rootEntries.Count -or @($actual | Where-Object {$tx.rootEntries -cnotcontains $_}).Count -gt 0) { throw 'Application folder contents changed' }
  Result 'installing' ''
  $swapStarted = $true
  Move-Retry $tx.active $tx.backup
  $moved = $true
  Move-Retry $tx.staged $tx.active
  Result 'restart_pending' ''
  Remove-Item -LiteralPath (Join-Path $Transaction 'health') -Force -ErrorAction SilentlyContinue
  $newProcess = Launch-App
  $deadline = [DateTime]::UtcNow.AddSeconds($tx.healthTimeout)
  while ([DateTime]::UtcNow -lt $deadline) {
    $health = Join-Path $Transaction 'health'
    if ((Test-Path -LiteralPath $health) -and (Get-Content -LiteralPath $health -Raw) -eq $tx.token) {
      Result 'updated' ''
      exit 0
    }
    $newProcess.Refresh()
    if ($newProcess.HasExited) { break }
    Start-Sleep -Milliseconds 250
  }
  throw 'The new version did not acknowledge a healthy startup'
} catch {
  try {
    if ($newProcess -and -not $newProcess.HasExited) { Stop-Process -Id $newProcess.Id -Force; $newProcess.WaitForExit(10000) | Out-Null }
    if ($swapStarted -and (Test-Path -LiteralPath $tx.backup)) {
      if (Test-Path -LiteralPath $tx.active) { Move-Retry $tx.active (Join-Path (Split-Path -Parent $tx.active) ('.sas-failed-' + $tx.token)) }
      Move-Retry $tx.backup $tx.active
      $snapshot = Join-Path $Transaction 'catalog-backup.json'
      if (Test-Path -LiteralPath $snapshot) { Copy-Item -LiteralPath $snapshot -Destination (Join-Path $tx.dataDir 'catalog.json') -Force }
      Result 'rolled_back' 'The new version did not start successfully. The previous version was restored.'
      $null = Launch-App
    } else { Result 'error' 'The application could not be replaced. The installed version was preserved.' }
  } catch { Result 'error' 'Automatic restoration failed. The previous version is in the backup folder.' }
  exit 1
} finally { Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue }
