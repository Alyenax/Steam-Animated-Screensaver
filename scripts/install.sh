#!/bin/sh
set -eu
source_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
target_parent="$HOME/.local/opt"
target="$target_parent/steam-animated-screensaver"
applications="$HOME/.local/share/applications"
test -f "$source_dir/.screensaver-application" || { echo 'Incomplete application package.' >&2; exit 1; }
test -x "$source_dir/steam-animated-screensaver" || { echo 'Application executable missing.' >&2; exit 1; }
case "$(uname -sm)" in 'Linux x86_64') ;; *) echo 'This candidate targets Linux x86_64.' >&2; exit 1;; esac
test ! -L "$target" || { echo 'Refusing a symbolic-link installation target.' >&2; exit 1; }
if test -e "$target"; then test -f "$target/.screensaver-application" || { echo 'Existing directory is not owned by this application.' >&2; exit 1; }; fi
if test "$source_dir" = "$target"; then echo 'Application is already installed here.'; exit 0; fi
mkdir -p "$target_parent" "$applications"
stage=$(mktemp -d "$target_parent/.screensaver-install.XXXXXX")
trap 'if test -n "${stage:-}"; then rm -rf -- "$stage"; fi' EXIT HUP INT TERM
cp -R "$source_dir/." "$stage/"
backup="$target_parent/.screensaver-previous-$$"
test ! -e "$backup" || { echo 'Backup path already exists.' >&2; exit 1; }
if test -d "$target"; then mv "$target" "$backup"; fi
if ! mv "$stage" "$target"; then
  if test -d "$backup"; then mv "$backup" "$target"; fi
  exit 1
fi
stage=''
# Desktop Exec double quoting follows the desktop-entry specification.
escaped_target=$(printf '%s' "$target" | sed 's/\\/\\\\/g; s/"/\\"/g; s/`/\\`/g; s/\$/\\$/g; s/%/%%/g')
cat > "$applications/steam-animated-screensaver.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Steam Animated Screensaver
Comment=Prepare and install animated artwork as a Steam screensaver.
Exec="$escaped_target/steam-animated-screensaver"
Icon=$target/icon.svg
Terminal=false
Categories=Game;AudioVideo;
StartupWMClass=steam-animated-screensaver
EOF
chmod 644 "$applications/steam-animated-screensaver.desktop"
if test -d "$backup" && test -f "$backup/.screensaver-application"; then rm -rf -- "$backup"; fi
# Retire only the previous owned application after the new copy and shortcut commit.
legacy="$target_parent/steamos-animated-screensaver"
legacy_marker="$legacy/.cinema-application"
if test ! -L "$legacy" && test ! -L "$legacy_marker" && test -f "$legacy_marker" && grep -Fxq 'steamos-animated-screensaver-v1' "$legacy_marker"; then
  rm -rf -- "$legacy"
  previous_shortcut="$applications/steamos-animated-screensaver.desktop"
  if test ! -L "$previous_shortcut" && test -f "$previous_shortcut" && grep -Fq 'SteamOS Animated Screensaver' "$previous_shortcut"; then rm -- "$previous_shortcut"; fi
fi
echo 'Installed. Open Steam Animated Screensaver from the application launcher.'
echo 'Add your SteamGridDB API key, prepare your library, then install the screensaver in Settings.'
