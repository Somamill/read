# read. for iPhone — Expo Go preview

The iPhone app lives in [`Apps/iPhone`](../Apps/iPhone). Version **0.1.1** targets **Expo SDK 58**, including Expo Go client **58.0.5**. It is a React Native app with native tab navigation, a local SQLite library, secure credential storage and a WebView reading engine. It does not embed the Mac dashboard or require a Mac account to start reading.

This is an initial mobile preview, not complete macOS feature parity. You do **not** need Xcode, an Apple Developer membership or an IPA to use it in Expo Go.

## Open the hosted preview on an iPhone

[**Open read. in Expo Go**](exp://u.expo.dev/144f24a8-e646-4acd-a3e3-4226538e4c89?runtime-version=exposdk%3A58.0.0&channel-name=iphone-preview)

Open this link on an iPhone with **Expo Go SDK 58**. The `iphone-preview` channel loads the latest compatible preview published to that channel. Expo hosts the app code and assets: your Mac does **not** need to remain running to open this preview. Downloaded books and local article text remain on the phone.

The hosted project is [@somamill/read-mobile](https://expo.dev/accounts/somamill/projects/read-mobile). Developer publishing uses an Expo account; it does not require Apple signing. Existing Calibre/KOSync services still need to be reachable when you synchronize with them. Hosting the app in Expo does not move those servers or your library files to Expo.

If you previously tried the temporary `exp.direct` link, use the hosted link above instead. Expo Go owns its home-screen icon and lifecycle; read.’s icon appears in the project listing.

### Run a local development preview

Developers can also run their own preview server:

```sh
git clone https://github.com/Somamill/read.git
cd read/Apps/iPhone
npm ci
npx expo login
npx expo start --go
```

Use the same Expo account in Expo CLI and Expo Go. Local development links require their computer to remain running and reachable. If LAN routing is blocked, `npx expo start --go --tunnel ngrok` can provide a temporary development tunnel. Sign-in on the iPhone does not sign in the computer.

## Connect existing services

Connections start empty on every installation. No developer passwords, private IP addresses, databases, books or tokens are bundled.

| Connection | Setup | Mobile behavior |
| --- | --- | --- |
| Calibre OPDS | Reachable OPDS URL, username/password | Browse navigation feeds; download EPUB, PDF and audio acquisitions for offline reading. Basic and MD5 Digest authentication are supported. Prefer HTTPS. |
| KOReader / CrossPoint | KOSync base URL, username/password | Identical EPUB files use KOReader’s sampled MD5 fingerprint. Progress is queued offline, compared with server timestamps and retried in the foreground. Positions are approximate percentages across rendering engines. |
| Readwise | Paste an access token | Local highlights remain independent. **Send new highlights** explicitly uploads passages/notes. |
| Readwise Reader | Save a Readwise token, then choose **Connect Readwise Reader library** | Imports supported documents in bounded batches, fetches content when opened, synchronizes supported reading positions and links exact, unambiguous title/author matches to imported EPUBs. PDF progress is not supported by the Reader API. |
| Hardcover | Paste an API token | Read-only list of currently-reading titles. This preview does not upload Hardcover status or provide live BookPlayer playback tracking. |
| iCloud Drive / Google Drive / OneDrive | Enable the provider in iOS Files | Import copies through the system file picker. This does not continuously watch an entire cloud folder. |

`127.0.0.1` on an iPhone refers to the phone, not your Mac. Use the server’s reachable LAN address, working hostname or trusted HTTPS endpoint. If you are away from home, your private services need an existing VPN or secure remote endpoint; the Expo preview tunnel does not expose or proxy those services. Do not put passwords in URLs.

Sync runs while read. is open, on foreground activation and approximately once per minute. Reader library refreshes are spaced five minutes apart after the initial paginated import; a pending page is fetched on the next foreground cycle, with at most 20 records per cycle. Large libraries arrive progressively. Expo Go/iOS can suspend the app; it cannot promise always-running background synchronization. A newer remote position wins over an older queued edit, including intentional rewinds. Articles never enter the EPUB KOSync queue. Different editions cannot be identified safely from an opaque hash alone.

## Included reading features

- EPUB import with Unicode metadata, publisher spine order, nested EPUB 3/NCX navigation, embedded images and covers.
- Paged or continuous reading, swipe gestures, keyboard page turning, adjustable text size, system/Bright/OLED Black appearance and a fading translucent toolbar.
- RSS/Atom subscriptions, curated feed discovery, feed previews and readable local article extraction with images. RSS addresses are subscribed to instead of treated as articles.
- Local highlights with selection tools, notes, search, daily passage review, sharing to Apple Notes via the iOS share sheet and optional Readwise export.
- Local audio playback, skip controls and saved playback progress. Original PDFs open in the iOS preview/share viewer with manually recorded progress.
- Finished/reading filters, local reading statistics, sanitized diagnostic copying and JSON export of the library/highlights/feed records.

## Current platform limits

- Mac-only Calibre administration, backup jobs, launch agents, Android provisioning, Apple Books private-database access, OCR/transcription and desktop Studio tools are not ported into Expo Go.
- BookPlayer does not expose a live playback API used by this app. Hardcover membership is not proof of BookPlayer position synchronization.
- PDF text extraction/annotation and automatic PDF page tracking are not implemented in this preview. Audio progress stays local; it is not equivalent to an EPUB location.
- Covers/images supplied by remote services can require a network connection. Imported EPUB covers and images are embedded locally.
- Password-protected, DRM-protected, login-only or oversized content can require its original readable file. Import limits: EPUB 32 MB compressed/64 MB expanded, media 250 MB, readable EPUB HTML 10 MB, Reader-provided text 2 MB.
- The JSON export excludes credentials and original PDF/audio binaries. Keep source media separately. A backup restore UI is not implemented yet. Removing Expo Go or clearing project storage can remove the local library.
- No live account integration or physical iPhone test is claimed by the automated checks; use **Test connections & retry sync** on your own network.

## Publish an update to the hosted preview

The official Expo project is configured in `app.json` with public owner/project identifiers. These are not credentials; publishing still requires an authorized Expo account. No API token is committed to this repository.

From `Apps/iPhone`, maintainers can run:

```sh
npx eas-cli@latest login
npm ci
npm run typecheck
npm run lint
npm test
npm run publish:preview -- --message "read. iPhone preview update"
```

The script publishes iOS updates to the `iphone-preview` branch using the `preview` environment. The channel of the same name points to that branch, so the shared link opens the latest compatible publication. Publish only after validation. Expo Go's preview behavior is not the same as a standalone app's background updater.

Keep `runtimeVersion.policy` set to **sdkVersion** for Expo Go previews and keep native dependencies compatible with Expo Go SDK 58. Do not switch to an app-version/fingerprint runtime while targeting this Expo Go client. Future SDK upgrades need a matching Expo Go client.

Forks must configure their own Expo project/account before publishing. The official project's identifiers grant no write access. A standalone iOS/TestFlight/App Store build remains a separate release path requiring Apple signing. See [Expo preview documentation](https://docs.expo.dev/review/share-previews-with-your-team/) and [Expo Updates](https://docs.expo.dev/versions/v58.0.0/sdk/updates/).

## Development checks

```sh
cd Apps/iPhone
npm ci
npm run assets
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx expo export --platform ios
```

The `iphone-preview` CI job runs dependency validation, lint/type checks, regression tests and an iOS JavaScript/Hermes export. It does not sign an IPA or require Apple credentials. Reader regression tests cover unsafe HTML, highlight restoration, chapter ordering/links, Japanese metadata, sampled document fingerprints, OPDS URLs and Digest authentication.

Shared article extraction and sanitization assets retain their original licenses. To refresh them from the desktop project, run `npm run assets`; this copies the shared sources and notices before generating the mobile script module. Never add personal configuration or library exports to the repository.
