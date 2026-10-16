#!/bin/sh
# Migrate only exports carrying this application's ownership marker.
set -eu
if test "$#" -gt 1; then echo 'Usage: repair-steam-screensaver.sh [Steam-root]' >&2; exit 1; fi
owned() {
  test -d "$1" && test ! -L "$1" || return 1
  for owner in steam-animated-screensaver steamos-animated-screensaver; do
    marker="$1/.$owner.json"
    if test ! -L "$marker" && test -f "$marker" && grep -Eq '"owner"[[:space:]]*:[[:space:]]*"'"$owner"'"' "$marker"; then return 0; fi
  done
  return 1
}
repair_root() {
  parent="$1/config/uioverrides/screensavers"
  target="$parent/steam-animated-screensaver"
  for directory in "$1/config" "$1/config/uioverrides" "$parent"; do
    if test -L "$directory"; then echo 'Refusing a symbolic-link screensaver path.' >&2; return 1; fi
  done
  if owned "$target"; then echo "Already using the current directory: $target"; return 0; fi
  if test -e "$target" || test -L "$target"; then echo 'Destination exists and is not owned. Left untouched.' >&2; return 1; fi
  found=''
  for name in steamos-animated-screensaver 'SteamOS Animated Screensaver'; do
    old="$parent/$name"
    if test -e "$old" || test -L "$old"; then
      if ! owned "$old"; then echo 'Unowned previous installation left untouched.' >&2; return 1; fi
      if test -n "$found"; then echo 'Multiple previous exports found. Use Update / Repair in the Manager.' >&2; return 1; fi
      found=$old
    fi
  done
  if test -z "$found"; then return 2; fi
  mv -- "$found" "$target"
  echo "Renamed the installed player to: $target"
  echo 'Restart Steam and select steam-animated-screensaver in Settings > Customization.'
  echo 'Use the current Manager for subsequent updates.'
}
if test "$#" -eq 1; then
  if repair_root "$1"; then exit 0; else status=$?; fi
  if test "$status" -eq 2; then echo 'No owned screensaver installation found at that Steam root.' >&2; fi
  exit "$status"
fi
for root in "${STEAM_ROOT:-$HOME/.steam/root}" "$HOME/.steam/steam" "$HOME/.local/share/Steam" "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam" "$HOME/Library/Application Support/Steam"; do
  if repair_root "$root"; then exit 0; else status=$?; fi
  if test "$status" -ne 2; then exit "$status"; fi
done
echo 'No installed player found. Pass your Steam root as an argument.' >&2
exit 1
