# read. for iPhone

The standalone iPhone app lives in [`Apps/iPhone`](../Apps/iPhone). It uses React Native and Expo SDK 58 with a local SQLite library, secure credential storage and a WebView reading engine. The app is not a wrapper around the Mac dashboard.

Expo Go previews are no longer maintained. End users install a signed app through its available TestFlight or App Store distribution; see the [Store build guide](APP_STORE.md) for maintainer instructions and the [releases page](https://github.com/Somamill/read/releases) for published availability. This guide does not imply a public Store release has already been approved.

A standalone installation works without keeping a development Mac running. Optional Calibre and sync services still need to be reachable for their own synchronization. The phone stores downloaded books and saved article text locally.

## Development

Run `npm ci` and `npx expo run:ios` from `Apps/iPhone` for a local native build. Xcode is a developer build dependency, not an end-user dependency. Use `bash scripts/build-store.sh ios` for signed Xcode archives and the native Store workflow for TestFlight. Store editions disable downloaded JavaScript updates and are updated through Apple distribution.

## Connect your existing Mac setup automatically

The Mac helper transfers the existing Calibre, KOReader/CrossPoint, Readwise and available Hardcover connections into this phone’s SecureStore. It also includes a full Calibre catalog snapshot, so books appear before you download their files.

On a Mac already configured with read.’s desktop services, run:

```sh
cd Apps/iPhone
npm run connect:mac
```

The helper requires Node, Python 3 and `cloudflared` (install the latter with `brew install cloudflared`). It reads the current owner’s desktop configuration and validates Calibre/sync access. It stores a **private setup link** in Downloads. Open that link on the iPhone; paste the complete link under **Connections → Connect from your Mac** and choose **Connect everything**. Existing connections require confirmation before replacement; local books/highlights remain intact.

Credentials and catalog metadata are encrypted with AES-256-GCM before passing through the temporary HTTPS relay. The decryption key stays in the setup link’s URL fragment, which is not sent to the relay server. The link opens the installed app directly using its registered `read-mobile` URL scheme. A high-entropy grant binds retrieval to the first device, retries are allowed for that device until acknowledgement, and the relay shuts down after confirmation or 30 minutes. Never put this private link in GitHub, a public issue or a screenshot. OAuth refresh credentials stay on their server; available stable API tokens can be transferred.

The full Calibre catalog refreshes automatically while the app is open. Later refreshes fetch new records and recently modified metadata; covers load and cache as needed. Book files download only when you open them. A cached catalog remains visible with the Mac off, but new downloads and Mac-hosted sync require that server to be online and reachable. Same-file identifiers, ISBN evidence and unambiguous title/author matches combine connections on one book record; uncertain editions stay separate instead of overwriting progress.

## Connect existing services

Connections start empty on every installation. No developer passwords, private IP addresses, databases, books or tokens are bundled.

| Connection | Setup | Mobile behavior |
| --- | --- | --- |
| Calibre OPDS | Reachable OPDS URL, username/password | Automatically show the complete Calibre catalog; load authenticated covers and download EPUB, PDF and audio files when opened. Basic and MD5 Digest authentication are supported. Prefer HTTPS. |
| KOReader / CrossPoint | KOSync base URL, username/password | Identical EPUB files use KOReader’s sampled MD5 fingerprint. Progress is queued offline, compared with server timestamps and retried in the foreground. Positions are approximate percentages across rendering engines. |
| Readwise | Paste an access token | Local highlights remain independent. **Send new highlights** explicitly uploads passages/notes. |
| Readwise Reader | Save a Readwise token, then choose **Connect Readwise Reader library** | Imports supported documents in bounded batches, fetches content when opened, synchronizes supported reading positions and links exact, unambiguous title/author matches to imported EPUBs. PDF progress is not supported by the Reader API. |
| Hardcover | Paste an API token | Automatically add currently-reading titles to the shelf and link unambiguous local copies. This preview does not upload Hardcover status or provide live BookPlayer playback tracking. |
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
- The JSON export excludes credentials and original PDF/audio binaries. Keep source media separately. A backup restore UI is not implemented yet. Removing the app or clearing its storage can remove the local library.
- No live account integration or physical iPhone test is claimed by the automated checks; use **Test connections & retry sync** on your own network.
