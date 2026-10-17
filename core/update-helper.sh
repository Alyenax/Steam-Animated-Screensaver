#!/bin/sh
# Runs from a private transaction directory after the application has closed.
# No downloaded script or release text is interpreted by this helper.
set -eu
transaction=$1
parent_pid=$2
active=$3
staged=$4
backup=$5
executable=$6
data_dir=$7
token=$8
health_timeout=$9
case "$token" in ''|*[!a-f0-9]*) exit 2;; esac
[ "${#token}" -eq 32 ] || exit 2
case "$parent_pid:$health_timeout" in *[!0-9:]*) exit 2;; esac
[ "$health_timeout" -ge 15 ] && [ "$health_timeout" -le 120 ] || exit 2
for p in "$transaction" "$active" "$staged" "$backup" "$data_dir"; do
  case "$p" in /*) ;; *) exit 2;; esac
  [ ! -L "$p" ] || exit 2
done
[ "$active" != / ] && [ "$active" != "$backup" ] && [ "$active" != "$staged" ] || exit 2
[ "$(cat "$transaction/token")" = "$token" ] || exit 2
if [ -f "$transaction/result.json" ] && grep -Eq '"phase":"(updated|rolled_back)"' "$transaction/result.json"; then exit 0; fi
if ! mkdir "$transaction/helper.lock" 2>/dev/null; then
  [ ! -L "$transaction/helper.lock" ] || exit 2
  previous_pid=$(cat "$transaction/helper.pid" 2>/dev/null || printf 0)
  case "$previous_pid" in ''|*[!0-9]*) exit 2;; esac
  if [ "$previous_pid" -gt 0 ] && kill -0 "$previous_pid" 2>/dev/null; then exit 3; fi
  rmdir "$transaction/helper.lock" || exit 3
  mkdir "$transaction/helper.lock"
fi
printf %s "$$" > "$transaction/helper-pid.tmp"
mv -f "$transaction/helper-pid.tmp" "$transaction/helper.pid"
trap 'rmdir "$transaction/helper.lock" 2>/dev/null || true' EXIT
result() {
  printf '{"phase":"%s","error":"%s"}\n' "$1" "$2" > "$transaction/result.tmp"
  mv -f "$transaction/result.tmp" "$transaction/result.json"
}
launch() {
  SAS_DATA_DIR="$data_dir" SAS_UPDATE_TOKEN="$token" SAS_UPDATE_HEALTH="$transaction/health" "$active/$executable" > /dev/null 2>&1 &
  new_pid=$!
}
# Wait for process exit and release of Electron / catalog locks.
tries=0
while kill -0 "$parent_pid" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -ge 120 ]; then result error 'The application did not close. The installed version was preserved.'; exit 1; fi
  sleep 1
done
# An interrupted first rename can be recovered by rerunning this saved helper.
if [ ! -e "$active" ] && [ -d "$backup" ]; then
  mv "$backup" "$active"
  result rolled_back 'An interrupted replacement was recovered.'
  launch
  exit 0
fi
[ -d "$active" ] && [ -d "$staged" ] && [ ! -e "$backup" ] || { result error 'Application paths changed. Installation was stopped.'; exit 1; }
[ "$(cat "$(dirname -- "$staged")/.sas-update-token")" = "$token" ] || exit 2
ls -A1 "$active" | LC_ALL=C sort > "$transaction/actual-inventory"
cmp -s "$transaction/root-inventory" "$transaction/actual-inventory" || { result error 'Application folder contents changed. Use manual installation to preserve extra files.'; exit 1; }
moved=0
new_pid=''
rollback() {
  trap - HUP INT TERM
  if [ -n "$new_pid" ] && kill -0 "$new_pid" 2>/dev/null; then
    kill "$new_pid" 2>/dev/null || true
    tries=0
    while kill -0 "$new_pid" 2>/dev/null && [ "$tries" -lt 10 ]; do sleep 1; tries=$((tries + 1)); done
    kill -9 "$new_pid" 2>/dev/null || true
    wait "$new_pid" 2>/dev/null || true
  fi
  if [ -d "$backup" ]; then
    if [ -e "$active" ]; then mv "$active" "$(dirname -- "$active")/.sas-failed-$token" 2>/dev/null || { result error 'Could not retire the failed version. The previous version is in the backup folder.'; exit 1; }; fi
    mv "$backup" "$active" || { result error 'Automatic restoration failed. The previous version is in the backup folder.'; exit 1; }
    if [ -f "$transaction/catalog-backup.json" ]; then
      cp "$transaction/catalog-backup.json" "$data_dir/.catalog-update-restore"
      chmod 600 "$data_dir/.catalog-update-restore"
      mv -f "$data_dir/.catalog-update-restore" "$data_dir/catalog.json"
    fi
  fi
  result rolled_back 'The new version did not start successfully. The previous version was restored.'
  launch
  exit 1
}
trap rollback HUP INT TERM
result installing ''
# Both renames stay on the installation filesystem. The previous app remains recoverable.
mv "$active" "$backup"
moved=1
if ! mv "$staged" "$active"; then rollback; fi
result restart_pending ''
rm -f "$transaction/health"
launch
tries=0
while [ "$tries" -lt "$health_timeout" ]; do
  if [ -f "$transaction/health" ] && [ "$(cat "$transaction/health")" = "$token" ]; then
    result updated ''
    exit 0
  fi
  if ! kill -0 "$new_pid" 2>/dev/null; then break; fi
  sleep 1
  tries=$((tries + 1))
done
rollback
