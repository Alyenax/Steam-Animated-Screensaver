#!/bin/sh
# Rename the owned 0.1.0 export without touching its catalog, settings or media.
set -eu
if test "$#" -gt 1; then echo 'Usage: repair-steam-screensaver.sh [Steam-root]' >&2; exit 1; fi
repair_root() {
  root=$1
  parent="$root/config/uioverrides/screensavers"
  old="$parent/SteamOS Animated Screensaver"
  target="$parent/steamos-animated-screensaver"
  if test ! -e "$old" && test ! -L "$old"; then
    if test -d "$target" && test ! -L "$target" && test ! -L "$target/.steamos-animated-screensaver.json" && test -f "$target/.steamos-animated-screensaver.json" && grep -Eq '"owner"[[:space:]]*:[[:space:]]*"steamos-animated-screensaver"' "$target/.steamos-animated-screensaver.json"; then
      echo "Already using the corrected directory: $target"
      return 0
    fi
    return 2
  fi
  for directory in "$root/config" "$root/config/uioverrides" "$parent" "$old"; do
    if test -L "$directory" || test ! -d "$directory"; then
      echo 'Refusing a symbolic link or unsafe screensaver directory.' >&2
      return 1
    fi
  done
  marker="$old/.steamos-animated-screensaver.json"
  if test -L "$marker" || test ! -f "$marker" || ! grep -Eq '"owner"[[:space:]]*:[[:space:]]*"steamos-animated-screensaver"' "$marker"; then
    echo 'This screensaver is not owned by SteamOS Animated Screensaver. Left untouched.' >&2
    return 1
  fi
  if test -e "$target" || test -L "$target"; then
    echo 'The corrected destination already exists. Use Update / repair in Manager 0.1.1.' >&2
    return 1
  fi
  mv -- "$old" "$target"
  echo "Renamed the installed player to: $target"
  echo 'Restart Steam, then select steamos-animated-screensaver in Settings > Customization.'
  echo 'Test both Preview and automatic activation after your idle timeout.'
  echo 'Use Manager 0.1.1 for future updates; 0.1.0 would recreate the previous folder name.'
}
if test "$#" -eq 1; then
  if repair_root "$1"; then exit 0; else status=$?; fi
  if test "$status" -eq 2; then echo 'No owned screensaver installation found at that Steam root.' >&2; fi
  exit "$status"
fi
for root in "${STEAM_ROOT:-$HOME/.steam/root}" "$HOME/.steam/steam" "$HOME/.local/share/Steam" "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam"; do
  if repair_root "$root"; then exit 0; else status=$?; fi
  if test "$status" -ne 2; then exit "$status"; fi
done
echo 'No installed player found. Run this script with your Steam root as its argument.' >&2
exit 1
