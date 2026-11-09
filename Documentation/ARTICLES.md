# Articles in read.

read. is free, MIT-licensed software. Saving articles, reading offline text, highlighting, notes, review, RSS, search, and exports require no account or subscription. Existing Readwise and Hardcover connections remain optional.

## Read later

Open Articles in the floating menu or press **Command–Shift–A**. Paste a public article URL. Mozilla Readability extracts the main content; DOMPurify and a second native allowlist remove executable content. A private local SQLite database stores the text and metadata. Re-saving a URL preserves its identity, reading position, tags, and finished status. Common campaign parameters and fragments are removed to reduce duplicates.

Read opens the same paginated native reader as EPUBs: keyboard page turns, appearance settings, searchable contents, and locally saved highlights. Listen uses macOS system speech. The speaker control stops or restarts speech; speech stops when leaving the reader. Reading positions are local to the article library and never overwrite a Calibre book's device position. Article highlights appear in the shared Highlights and Review views and reopen their source article.

Inbox, Later, Finished, Starred, tags, and full-text search help organize articles. Trash is recoverable. Export Markdown writes plain article text and source links; highlight exports remain available separately in Highlights. Export before moving computers: automatic article-library cloud syncing is not implemented.

## Links stay in read.

Clicking a web link in an article or EPUB saves its readable content and opens it in the same reader. Readwise `/save?url=…` wrappers resolve directly to their source. Contents anchors keep their normal in-document behavior. A small loading indicator appears while the source is prepared; leaving the reader cancels the pending navigation.

Linked PDFs up to 32 MB are downloaded privately and converted from selectable PDF text into paginated reading sections. Highlights, local progress, and speech work on that text. Image-only pages use on-device OCR for English, German, and Japanese, with a 20 scanned-page limit to bound processing time.

Linked EPUBs up to 32 MB are cached privately and open with their original spine, resources, and contents. For Readwise-only newsletter book landing pages, read. searches the Standard Ebooks publisher named by Wisereads and requires a unique exact title match before choosing a public EPUB. Ambiguous matches fail visibly rather than opening an unrelated edition. Private Readwise library URLs without a source cannot be recovered automatically.

These links never fall back silently to Readwise. Video players, private social threads, and login-only documents do not become readable articles automatically. **Open original in browser** remains an explicit action in an article's details.

## Feeds and the weekly selection

Subscribe with a public RSS or Atom URL under RSS & Atom subscriptions. New subscriptions start with the ten newest entries; later refreshes import unseen stories without reimporting older history. Clicking an RSS link subscribes and opens its source instead of trying to extract article text. The source's preview is shown accurately as a preview; opening it fetches and saves the full article. Refresh is limited to once per 15 minutes per feed and runs on entering Articles or while that view is open. Removing a subscription preserves saved articles.

This week makes a personal selection from your uncompleted saved stories, with starred items first. It is not a community popularity ranking, generated summary, or email newsletter. Review links into your existing local highlight review system.

## Practical limits

Saved text and cached article images are available offline. Up to eight illustrations per article are downloaded in the background with size and time limits; scripts, video players, and known tracking pixels are omitted. Extraction cannot access content behind a login or guarantee every publisher layout. When static extraction fails, an isolated publisher view can capture rendered text through Reader mode. Use Open original when needed. The app does not bypass paywalls. Pages are limited to 4 MB; private/local destinations and nonstandard ports are rejected. Publisher material remains subject to its own rights; the app's MIT license applies to code, not saved content.

No hosted newsletter mailbox, cross-device article sync, browser extension, or cloud AI is required or bundled. Those can be added as separate integrations without changing the local data model.

## Third-party code

- Mozilla Readability **0.6.0**, Apache-2.0: `Resources/Dashboard/Vendor/Readability-LICENSE.md`.
- DOMPurify **3.4.17**, offered under Apache-2.0 or MPL-2.0; use the Apache-2.0 option: `Resources/Dashboard/Vendor/DOMPurify-LICENSE`.
- jsdom is used only by development tests, not shipped as a runtime dependency.

## Rename compatibility

The project is read. and the app is `read.app`. The existing `app.shelf.dashboard` bundle identity, configuration directory, signing identity, old highlight IDs, and `shelf://` links are deliberately preserved. Changing them would disconnect macOS permissions, stored credentials, annotations, and existing update installations. Public project names, source modules, Xcode project, installer, repository, and Homebrew cask use the new name. Previous GitHub URLs redirect to `Somamill/read`; the Sparkle public key is unchanged.

## Highlighting and daily review

Select text to reveal Highlight and Apple Notes actions, or press H to save the selection. Apple Notes uses the macOS sharing composer so you choose where to save; read. does not request access to your Notes database. Exported passages include a link back to the local highlight. Daily review includes book and article passages when both are due. In-progress articles also appear alongside books in Continue reading. Trackpad scrolling pans pages smoothly and settles on a page; wide windows show two or three reading columns.

## Reading layouts and discovery

Reading appearance offers automatic pages, one page, two pages, and continuous scrolling. The layout is remembered and switching preserves approximate progress. Articles hide chapter navigation; PDFs retain their page sections and EPUBs their contents. Previous/next article buttons move within the same feed and skip Trash.

The bottom controls fade after inactivity and return with pointer or keyboard interaction. Native clear Liquid Glass is used on macOS 26; older macOS uses a translucent AppKit material. Reduce Motion and VoiceOver preferences are respected.

Explore feeds ranks a curated publisher catalog using your existing subscriptions and article titles/tags, entirely on this Mac. Suggestions explain their relationship to followed sources. Subscribe explicitly to a suggestion or paste another RSS address. Article illustrations load when cards come into view; converted PDFs use a first-page preview and documents without an image have a typography thumbnail.
