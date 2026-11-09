# Release audit: 0.3.3

## What a new user needs

- macOS 14 or later, on Apple Silicon or Intel. The DMG bundles both Python runtimes; no Xcode, Python, Node or Homebrew is required.
- Local articles, RSS, highlights, review and export work without an account or Calibre. Start reading completes local setup without preselecting services.
- To use an existing book library, install Calibre separately and select its local library. Drag-and-drop uses Calibre directly when no custom import pipeline is installed; embedded metadata and covers are imported. Calibre can refuse direct CLI writes while its GUI/server is running; close the competing Calibre process or use a configured server-side importer, then retry. Failed imports retain the incoming files. The optional custom pipeline adds its configured audit/enrichment jobs. Sync columns are optional and resolved by label, never numeric IDs.
- Connections require the user's own server address and credentials. No author accounts, keys, library, background jobs or cloud data are shipped. Optional servers are not provisioned by installing read.
- Keep the active Calibre database on local storage; cloud providers can supply incoming files through their desktop clients.

## Release gates

1. Python behavioral tests, JavaScript DOM tests and shared Swift tests pass.
2. Build the universal app; verify signatures, bundled runtimes and startup using an isolated configuration in CI.
3. Validate the updater archive and signed feed with the existing update key. Increase the build number on every published update.
4. Merge only after CI succeeds; the validated main commit triggers the release workflow.
5. Confirm DMG, checksum, versioned archive, appcast and public update key exist in the GitHub release. Compare the feed version/key with the installed app.

## Diagnostics and maintenance

Connections, current errors, Copy logs and errors, and diagnostic export are available in the app. Exports redact known credentials; review the contents before posting publicly. Debuggers, development sync and development tools are not started by the release app. Obsolete local Xcode workspaces are excluded from version control and release inputs. Existing compatibility bundle IDs and private state locations remain stable so updates retain data and permissions.

## Distribution limit

Only the Sparkle update-signing secret is configured at audit time. Releases therefore use the documented unsigned community path, not Apple Developer ID notarization. First launch may require System Settings → Privacy & Security → Open Anyway. Gatekeeper is kept enabled. Fully frictionless public installation requires configuring Developer ID and notarization secrets as described in RELEASING.md. Signed updater archives do not imply Apple notarization.

No audit can guarantee every external provider, hardware device, login or future macOS change. CI and reproducible regression tests protect the local app; account and device checks depend on the services the user connects.
