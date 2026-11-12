#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export DOT_EDITION=store
export DOT_PLATFORM=macos
npx expo prebuild --platform ios
DOT_MAC_BUILD_DIR="${DOT_MAC_BUILD_DIR:-${TMPDIR:-/tmp}/dot-read-mac-build}"
xcodebuild -jobs "${DOT_BUILD_JOBS:-4}" \
  -workspace ios/read.xcworkspace -scheme read -configuration Release \
  -destination 'generic/platform=macOS,variant=Mac Catalyst' \
  -derivedDataPath "$DOT_MAC_BUILD_DIR" \
  MACOSX_DEPLOYMENT_TARGET=13.4 IPHONEOS_DEPLOYMENT_TARGET=16.4 \
  SUPPORTS_MACCATALYST=YES build
DOT_MAC_APP="$DOT_MAC_BUILD_DIR/Build/Products/Release-maccatalyst/read.app"
codesign --verify --deep --strict "$DOT_MAC_APP"
productbuild --component "$DOT_MAC_APP" /Applications \
  --sign '3rd Party Mac Developer Installer: Max Miller (YJH8WWUVF3)' \
  "${DOT_MAC_PACKAGE:-${TMPDIR:-/tmp}/dot-read-store.pkg}"
