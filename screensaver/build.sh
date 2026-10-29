#!/bin/zsh
# Builds "Odle Dolomites Italy.saver" from its own page in web/ and the shared
# scene in core/.
# Usage: screensaver/build.sh [--install] [--release]
#   --install  also copies it into ~/Library/Screen Savers
#   --release  also zips it into release/, ready to attach to a GitHub release
set -euo pipefail

install=false release=false
for argument in "$@"; do
  case $argument in
    --install) install=true ;;
    --release) release=true ;;
    *) echo "usage: screensaver/build.sh [--install] [--release]" >&2; exit 2 ;;
  esac
done

here=${0:A:h}
repo=${here:h}
name="Odle Dolomites Italy"
out="$here/build/$name.saver"
contents="$out/Contents"

rm -rf "$here/build"
mkdir -p "$contents/MacOS" "$contents/Resources/web/assets"

# Universal binary, linked as a loadable bundle (MH_BUNDLE).
for arch in x86_64 arm64; do
  xcrun swiftc -O \
    -target "$arch-apple-macos12" \
    -module-name OdleSaver \
    -framework ScreenSaver -framework WebKit -framework IOKit \
    -Xlinker -bundle \
    -o "$here/build/OdleSaver-$arch" \
    "$here"/Sources/*.swift
done
lipo -create -output "$contents/MacOS/OdleSaver" "$here"/build/OdleSaver-*
rm "$here"/build/OdleSaver-*

cp "$here/Info.plist" "$contents/Info.plist"
cp "$repo/LICENSE" "$repo/LICENSE-CONTENT.txt" "$repo/NOTICE" "$contents/Resources/"

# Gallery image in System Settings (it is not a live preview).
cp "$here"/Resources/thumbnail*.png "$contents/Resources/"

# The screen saver's own page and the shared scene assets; the site's
# interface (odle-ui.js, photo-life.css) is not loaded by the page.
cp "$here/web/index.html" "$contents/Resources/web/"
rsync -a --exclude .DS_Store --exclude "*.md" --exclude "*.css" "$repo/core/assets/" "$contents/Resources/web/assets/"

codesign --force --sign - "$out"
echo "Built $out"

if $install; then
  dest="$HOME/Library/Screen Savers"
  mkdir -p "$dest"
  # Odle.saver and "Odle - Dolomites - Italy.saver" are older names.
  rm -rf "$dest/$name.saver" "$dest/Odle.saver" "$dest/Odle - Dolomites - Italy.saver"
  cp -R "$out" "$dest/"
  # Make the running screen saver host pick up the new version.
  killall legacyScreenSaver 2>/dev/null || true
  echo "Installed in $dest"
fi

if $release; then
  # A .saver is a folder: the ZIP makes it a single file to download, and
  # ditto keeps the signature and the bundle as Finder expects them. GitHub
  # turns spaces in release asset names into dots, so the ZIP uses hyphens;
  # it still extracts to "$name.saver".
  zip="$here/release/${name// /-}.saver.zip"
  mkdir -p "$here/release"
  rm -f "$zip"
  ditto -c -k --sequesterRsrc --keepParent "$out" "$zip"
  echo "Zipped into $here/release"
fi
