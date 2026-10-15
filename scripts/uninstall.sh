#!/bin/sh
set -eu
target="$HOME/.local/opt/steamos-animated-screensaver"
test ! -L "$target" || { echo 'Refusing a symbolic-link installation target.' >&2; exit 1; }
if test -d "$target"; then
  test -f "$target/.cinema-application" || { echo 'This directory is not owned by this application.' >&2; exit 1; }
  rm -rf -- "$target"
fi
shortcut="$HOME/.local/share/applications/steamos-animated-screensaver.desktop"
if test -f "$shortcut" && grep -q 'SteamOS Animated Screensaver' "$shortcut"; then rm -- "$shortcut"; fi
echo 'Application removed. Your library, API key and installed Steam screensaver are preserved.'
echo 'Remove the screensaver from Manager Settings before uninstalling the app, if desired.'
echo 'To erase local data explicitly, remove ~/.config/steamos-animated-screensaver after backing it up.'
