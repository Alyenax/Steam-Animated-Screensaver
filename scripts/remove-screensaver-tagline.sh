#!/bin/sh
# Hide only the player's promotional tagline in existing owned installations.
set -eu
rule='.caption .eyebrow { display: none !important; }'
changed=0
patch_player() {
  folder=$1
  css="$folder/player.css"
  if test -L "$folder" || test -L "$css" || test ! -f "$css"; then return; fi
  backup="$folder/player.css.before-tagline-removal"
  if test -L "$backup"; then echo 'Refusing an unsafe backup link.' >&2; exit 1; fi
  if ! grep -Fq "$rule" "$css"; then
    if test ! -e "$backup"; then cp "$css" "$backup"; fi
    printf '\n%s\n' "$rule" >> "$css"
  fi
  changed=$((changed + 1))
}
if test "$#" -gt 1; then echo 'Usage: remove-screensaver-tagline.sh [Steam-root]' >&2; exit 1; fi
default_installation=0
if test "$#" -eq 0; then
  default_installation=1
  set -- "${STEAM_ROOT:-$HOME/.steam/root}" "$HOME/.steam/steam" "$HOME/.local/share/Steam" "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam"
fi
for root in "$@"; do
  for name in steamos-animated-screensaver 'SteamOS Animated Screensaver'; do
    folder="$root/config/uioverrides/screensavers/$name"
    marker="$folder/.steamos-animated-screensaver.json"
    if test ! -L "$marker" && test -f "$marker" && grep -Eq '"owner"[[:space:]]*:[[:space:]]*"steamos-animated-screensaver"' "$marker"; then
      patch_player "$folder"
    fi
  done
done
application="$HOME/.local/opt/steamos-animated-screensaver"
if test "$default_installation" -eq 1 && test ! -L "$application" && test ! -L "$application/.cinema-application" && test -f "$application/.cinema-application" && grep -Fq 'steamos-animated-screensaver-v1' "$application/.cinema-application"; then
  patch_player "$application/resources/app/player"
fi
if test "$changed" -eq 0; then echo 'No owned player found. Pass your Steam root as an argument.' >&2; exit 1; fi
echo 'Tagline hidden. Restart the Manager/Steam to reload the player.'
echo 'Artwork, game titles and artist credits are unchanged. CSS backups were kept.'
