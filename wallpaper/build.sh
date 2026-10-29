#!/bin/zsh
# Builds the dynamic wallpapers "Odle Dolomites Italy Summer.heic" and
# "... Winter.heic" from the wallpaper page in web/ and the shared scene in core/.
# Usage: wallpaper/build.sh [--frames] [--release]
#   --frames   also keeps every frame as a PNG in build/frames/
#   --release  also copies the wallpapers into release/, ready to attach to a
#              GitHub release
set -euo pipefail

here=${0:A:h}
repo=${here:h}
name="Odle Dolomites Italy"
build="$here/build"
# One day per wallpaper: the light, the snow and the Moon of that day. Both
# have a waning Moon, not full, in view at night and at dawn.
typeset -A days=(Summer 2026-07-05 Winter 2026-01-08)
keep_frames=false release=false
for argument in "$@"; do
  case $argument in
    --frames) keep_frames=true ;;
    --release) release=true ;;
    *) echo "usage: wallpaper/build.sh [--frames] [--release]" >&2; exit 2 ;;
  esac
done

rm -rf "$build"
mkdir -p "$build/web/assets"
cp "$here/web/index.html" "$here/web/frames.js" "$build/web/"
rsync -a --exclude .DS_Store --exclude "*.md" --exclude "*.css" "$repo/core/assets/" "$build/web/assets/"

xcrun swiftc -O -o "$build/render" "$here/Sources/main.swift"

for season in Summer Winter; do
  frames=()
  $keep_frames && frames=(--frames "$build/frames/$season")
  "$build/render" "$build/web" "${days[$season]}" "$build/$name $season.heic" "${frames[@]}"
done
rm -rf "$build/web" "$build/render"

if $release; then
  # GitHub turns spaces in release asset names into dots: use hyphens.
  mkdir -p "$here/release"
  for season in Summer Winter; do
    cp "$build/$name $season.heic" "$here/release/${name// /-}-$season.heic"
  done
  echo "Copied into $here/release"
fi
