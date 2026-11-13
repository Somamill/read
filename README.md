<p align="center"><img src="Documentation/Brand/read-icon.svg" width="96" height="96" alt="read. — an open book with lifted pages"></p>

![read. — a free, open-source macOS reader for EPUB books, offline articles, RSS feeds and highlights](Documentation/Brand/read-hero.jpg)

# read. — Books, articles & highlights for macOS

**A free, open-source EPUB reader and read-it-later app for macOS.** Save articles offline, follow RSS feeds, highlight passages and bring your Calibre library into one calm reading space. Optional connections include KOReader, CrossPoint, Hardcover, Readwise and Apple Books.

[![Latest release](https://img.shields.io/github/v/release/Somamill/read?style=flat-square&color=2879d0)](https://github.com/Somamill/read/releases/latest)
[![Build and validate](https://github.com/Somamill/read/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Somamill/read/actions/workflows/ci.yml)
[![MIT license](https://img.shields.io/badge/license-MIT-555?style=flat-square)](LICENSE)
[![macOS 14 or later](https://img.shields.io/badge/macOS-14%2B-555?style=flat-square)](Documentation/DEPENDENCIES.md)

[**Download for Mac**](https://github.com/Somamill/read/releases/latest) · [See the features](#what-read-does) · [Installation](#install-and-build) · [Documentation](Documentation/ARTICLES.md) · [Contribute](CONTRIBUTING.md)

Start with local articles and highlights: **no account, subscription, Xcode or separate Python installation required.** Calibre and connected services are optional dependencies for their respective features. Releases currently use the unsigned community distribution path described below.

## iPhone preview

The standalone iPhone app uses the same local-first reading model. See the [iPhone guide](Documentation/IPHONE.md) and [Store build instructions](Documentation/APP_STORE.md). Expo Go previews are no longer maintained; current public availability is shown on the [releases page](https://github.com/Somamill/read/releases).

## What read. does

![Books, Articles & RSS, and Highlights — read.’s three core reading workflows with the current open-book identity](Documentation/Brand/read-features.jpg)

*Promotional artwork, not an app screenshot.*

- **Articles, freely.** Save a URL into a local reading inbox, read its text offline, highlight and annotate in the paginated reader, and export your collection as Markdown. No account or subscription required.
- **Feeds and a weekly pause.** Follow RSS/Atom sources, search full article text, organize Inbox/Later/Finished with tags and stars, and choose a weekly selection from your own saved stories. Listen using macOS system speech.


- **One shelf across sources.** Browse Calibre titles and formats alongside reading records from Apple Books, Hardcover, and connected readers. Matching uses title and author evidence so different editions can share one shelf entry.
- **Covers and metadata.** Loads embedded Calibre covers, then checks high-confidence Open Library results for missing artwork and saves successful matches back into Calibre. If no reliable cover is available, read. shows a readable title card instead of an empty image box.
- **Read and track.** Open EPUBs in the built-in paginated reader, keep progress and highlights, and view finish status and reading statistics.
- **Highlights and review.** Search passages across sources, edit notes and tags, save collections, review highlights one at a time with a saved daily goal and spaced return dates, and export Markdown/CSV/JSON. Imports, annotation backups, and an optional upload queue keep the workflow local until you enable a destination. See [Highlights guide](Documentation/HIGHLIGHTS.md).
- **Reading Studio.** Recognize text from images/PDFs locally, transcribe downloaded audio, ask cited questions of your highlights, and export snapshots directly to Notion. External uploads require explicit action. See [Studio setup and limits](Documentation/STUDIO.md).
- **Sync services.** Check Calibre, KOReader Sync, CrossPoint, Hardcover, Readwise, and Readwise Reader connections from the dashboard.
- **Device setup.** Configure supported KOReader/CrossPoint readers and see when a reader last sent progress. A disconnected reader can only upload after it reconnects to Wi-Fi.
- **A focused interface.** Choose Black (OLED black) or Bright. Motion follows macOS reduced-motion settings and uses native WebKit timing at the display’s supported refresh rate.

### Interface showcase

These earlier demo interface images use illustrative sample books and connection states. They show the project’s reading workflows, not an exact screenshot of the current release. No personal library, account details or local network addresses are included.

| Bookshelf and EPUB import | Connected reading services | Reading statistics |
| --- | --- | --- |
| ![read. bookshelf and EPUB import](Documentation/Screenshots/library.png) | ![read. service connections](Documentation/Screenshots/connections.png) | ![read. reading statistics](Documentation/Screenshots/reading-statistics.png) |

## Install and build

### Install a release

Download the latest [read. DMG](https://github.com/Somamill/read/releases/latest) and drag read. into Applications. Releases are self-contained and do not require Xcode, Command Line Tools, or a separate Python installation. Until Apple Developer signing is available, the DMG is an unsigned community build. If macOS blocks its first launch, open read. once, then go to **System Settings → Privacy & Security → Open Anyway** and confirm. This approves read. while leaving Gatekeeper enabled. See [Apple's instructions](https://support.apple.com/en-nz/102445) and check the release's SHA-256 checksum before installing. Homebrew users can install it with:

```sh
brew tap somamill/read https://github.com/Somamill/read.git
brew trust --cask somamill/read/read
brew install --cask somamill/read/read
```

Start reading articles and saving highlights without an account or Calibre installation. First launch also detects common Calibre library locations; connect your own library and optional services whenever you want. No accounts, server credentials, or personal library are included.

### Automatic updates

Updater-enabled releases can check, download, and install signed updates from inside read. Enable the options under Updates after the one-time bootstrap installation. Developers configure update signing once; see [Automatic updates](Documentation/AUTOMATIC-UPDATES.md).

### Build from source

See [Dependencies](Documentation/DEPENDENCIES.md) for source-build tools. A local Calibre library is optional; articles and highlights can be used independently.

```sh
git clone https://github.com/Somamill/read.git
cd read
Scripts/build-and-install.sh
```

To package a locally built app for testing, run `Scripts/package-dmg.sh /Applications/read.app`. See [release setup](Documentation/RELEASING.md) for the signed and unsigned release paths.

## Set up your reading sources

1. Choose **Start reading** for local articles and highlights, or select an existing Calibre library and incoming-books folder.
2. Add the services and devices you use under **Connections** and **Setup**.
3. Keep Calibre’s active library on local storage. Use iCloud Drive, OneDrive, or Google Drive only for incoming files that their official sync app downloads to this Mac. Do not sync Calibre’s live database folder through a cloud drive.
4. On CrossPoint/KOReader devices, enable document metadata and sync when the reader is back online. read. processes a reader upload automatically; it cannot make a disconnected device upload over Wi-Fi.

Apple Books support reads the locally synced Books database on this Mac and reports available progress. Protected Apple Books files stay in Books; read. does not copy or alter them. Catalog metadata import is separate from importing book files.

## Privacy and data safety

- read. reads Calibre metadata and cover files locally. User passwords and API keys are kept in owner-only files under `~/Library/Application Support/Shelf`.
- Apple Books data is read locally. The catalog importer creates metadata-only Calibre entries and does not copy protected book content.
- read. does not upload your library to a read.-operated cloud service. Connected services receive only the data needed for the enabled sync feature.
- Review diagnostic exports before sharing. Never commit credentials, private library databases, or personal logs.

## Project layout

```text
Sources/ReadCore/       Shared models and core logic
Sources/ReadMacApp/     Native macOS application and service adapters
Resources/Dashboard/     read. dashboard and reader interface
Resources/Icons/         App icon and macOS icon set
Scripts/                 Build and optional maintenance helpers
Documentation/           Architecture, dependencies, and screenshots
```

See [Architecture](Documentation/ARCHITECTURE.md), [Dependencies](Documentation/DEPENDENCIES.md), [Security](SECURITY.md), [Contributing](CONTRIBUTING.md), and [Changelog](CHANGELOG.md).

## Scope

read. is currently a macOS app. The shared core is structured to support a future iPhone companion, but an iPhone app and direct Google Drive/Microsoft Graph integrations are not included in this release. Cloud-drive support means using files that the provider’s official macOS sync client has made available locally.

## License

read. is released under the [MIT License](LICENSE).

### Focused reading workflows

Use **⌘K** on Mac to find a page, save an article, open a saved reading view or search the local library. iPhone has a search action beside page titles. Articles support named metadata queries and explicit bulk inbox actions; views remain local to each device. See [Reading views](Documentation/READING_VIEWS.md) for query examples and [Readwise research](Documentation/Research/Readwise.md) for feature coverage and integration limits.
