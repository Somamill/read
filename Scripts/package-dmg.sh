#!/bin/bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${SHELF_VERSION:-$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "${1:-/Applications/read.app}/Contents/Info.plist" 2>/dev/null || sed -n 's/.*MARKETING_VERSION: //p' "$ROOT/project.yml" | head -1)}"
APP_PATH="${1:-/Applications/read.app}"
OUTPUT="${2:-$ROOT/dist/read-${VERSION}.dmg}"
if [[ ! -d "$APP_PATH" ]]; then
  echo "read.app not found at: $APP_PATH" >&2
  echo "Build it first or pass the app bundle path as the first argument." >&2
  exit 1
fi
mkdir -p "$(dirname "$OUTPUT")"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/shelf-dmg.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
ditto "$APP_PATH" "$STAGE/read.app"
PYTHON_ROOT="$STAGE/read.app/Contents/Resources/PythonRuntime"
if [[ ! -x "$PYTHON_ROOT/arm64/python/bin/python3" || ! -x "$PYTHON_ROOT/x86_64/python/bin/python3" ]]; then
  "$ROOT/Scripts/download-python-runtime.sh" "$PYTHON_ROOT"
  # This fallback is for locally built preview DMGs. CI release builds embed
  # the runtimes before applying either Developer ID or ad-hoc signing.
  codesign --force --deep --sign - "$STAGE/read.app"
fi
ln -s /Applications "$STAGE/Applications"
cat > "$STAGE/Install read..txt" <<'TXT'
Install read.

1. Drag read.app into Applications.
2. Open read. from Applications.
3. On first launch, choose Use detected library, or select your Calibre library in Setup.

For public releases, download the DMG from the official read. GitHub release page. If macOS blocks the first launch of an unsigned community build, try opening read. once, then use System Settings > Privacy & Security > Open Anyway. This leaves Gatekeeper enabled. Check the release SHA-256 checksum before installing.
TXT
hdiutil create -quiet -volname "read. ${VERSION}" -srcfolder "$STAGE" -ov -format UDZO "$OUTPUT"
echo "Created $OUTPUT"
