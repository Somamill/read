# App Store editions

The Store build uses `Apps/iPhone` for iOS/iPadOS and Mac Catalyst, with universal bundle ID `io.github.somamill.read.mobile`. Apple team: `YJH8WWUVF3`; App Store Connect app: `6834109889`. Pricing is free. The full native desktop app keeps its existing identity and direct-distribution features.

## Build and signing

From `Apps/iPhone`, install with `npm ci`, then run `npm run typecheck`, `npm run lint`, `npm test`, and `npx expo-doctor`. The native build script sets `DOT_EDITION=store`, disables hosted JavaScript updates, removes unused microphone/Face ID permission text, and includes local-network and privacy declarations. Use `DOT_BUILD_NUMBER=8 bash scripts/build-store.sh ios`; add `--upload` with the approved `ASC_KEY_ID` and `ASC_ISSUER_ID` to validate and upload through Apple tools. Expo/EAS account connections are not used.

Signing uses a locally generated, gitignored `credentials.json` referring to a distribution P12 and App Store profile kept outside the checkout. Never commit keys, passwords, profiles, Apple login sessions or Expo tokens. An authorized maintainer can alternatively configure EAS-managed credentials and change `credentialsSource` deliberately.

For Mac Catalyst, run `DOT_EDITION=store DOT_PLATFORM=macos npx expo prebuild --platform ios --clean`. The config plugin enables Catalyst and separate Mac sandbox entitlements, and compiles dependency frameworks from source. Xcode 27 requires `IPHONEOS_DEPLOYMENT_TARGET=16.4 MACOSX_DEPLOYMENT_TARGET=13.4 SUPPORTS_MACCATALYST=YES` on the build command to avoid older pod defaults. Build with destination `generic/platform=macOS,variant=Mac Catalyst`. Generated native folders remain ignored. Archive/export with the Mac Catalyst App Store profile and the authorized distribution credentials only after compilation and device checks pass.

## Privacy and review

No account is required. Reviewers can import a local unprotected EPUB without a server. Provide a redistributable test book and steps, actual device/simulator screenshots, support/privacy URLs, and accurate contact details. Optional sync may transmit user content, product interactions and account identifiers to user-selected services, linked to those accounts, solely for app functionality. No tracking is used. Reconcile App Store privacy answers with the final binary and [policy](../PRIVACY.md).

Before submission, verify imported EPUB/PDF/audio, article parsing, highlights, offline reopening, optional services, secure storage, deletion/export, Dynamic Type, VoiceOver, keyboard and pointer use, light/dark mode, sandbox access and required-reason manifests. Validate the signed archive with Apple and verify TestFlight processing; queueing an EAS build is not a release. Screenshots must show this Store build. Apple makes the final review decision.

The canonical local packaging command is `bash scripts/package-store-mac.sh` from `Apps/iPhone`, after installing the authorized signing identities and profiles. It retains the Store build environment for bundling, limits compiler jobs, stages the finished app outside file-provider folders, verifies its signature and signs the installer. Set `DOT_MAC_BUILD_DIR` to reuse a chosen native build cache. Apple package validation and native acceptance still follow packaging.
