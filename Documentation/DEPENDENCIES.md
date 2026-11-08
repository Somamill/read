# Dependencies

## Install read.

- macOS 14 or later.
- No Xcode, Command Line Tools, Python, or Homebrew installation is required. read.’s DMG includes a universal CPython runtime for its local helpers.

## Build read. from source

- Xcode 16 or later / macOS Command Line Tools with Swift, AppKit, WebKit, Foundation, Security, and CryptoKit.
- Python 3.13 is downloaded and checksum-verified by `Scripts/download-python-runtime.sh` for universal local builds.
- Node.js only for the optional JavaScript syntax check.

The embedded Python runtime is CPython from Astral’s python-build-standalone release; its upstream licenses remain in the app bundle under `Resources/PythonRuntime`. The macOS app uses the pinned Sparkle 2.10.1 binary package for signed updates. Swift Package Manager verifies its upstream checksum; local build tools use the same checksum. `ReadCore` uses Foundation only and declares iOS 17 compatibility for future reuse.

## Optional integrations

- Calibre and its command-line tools for the library, reader conversion, and OPDS services.
- KOReader Sync or CrossPoint Sync for progress/highlight synchronization.
- The official OneDrive or Google Drive desktop client when using those synced folders on macOS.
- Docker, Homebrew, Android Debug Bridge, Restic, EPUBCheck, and ClamAV only when the matching optional jobs are configured.

These integrations are configured per Mac. read. does not bundle their binaries or credentials.

## Article extraction

Mozilla Readability 0.6.0 (Apache-2.0) and DOMPurify 3.4.17 (Apache-2.0 or MPL-2.0; Apache option used) are vendored with original licenses in Resources/Dashboard/Vendor. No Node runtime is needed by installed users. jsdom is a pinned development-only dependency for real DOM/extraction tests. See Documentation/ARTICLES.md for offline, feed, and privacy limits.
