# Articles in read.

read. is free, MIT-licensed software. Saving articles, reading offline text, highlighting, notes, review, RSS, search, and exports require no account or subscription. Existing Readwise and Hardcover connections remain optional.

## Read later

Open Articles in the floating menu or press **Command–Shift–A**. Paste a public article URL. Mozilla Readability extracts the main content; DOMPurify and a second native allowlist remove executable content. A private local SQLite database stores the text and metadata. Re-saving a URL preserves its identity, reading position, tags, and finished status. Common campaign parameters and fragments are removed to reduce duplicates.

Read opens the same paginated native reader as EPUBs: keyboard page turns, appearance settings, searchable contents, and locally saved highlights. Listen uses macOS system speech. The speaker control stops or restarts speech; speech stops when leaving the reader. Reading positions are local to the article library and never overwrite a Calibre book's device position. Article highlights appear in the shared Highlights and Review views and reopen their source article.

Inbox, Later, Finished, Starred, tags, and full-text search help organize articles. Trash is recoverable. Export Markdown writes plain article text and source links; highlight exports remain available separately in Highlights. Export before moving computers: automatic article-library cloud syncing is not implemented.

## Feeds and the weekly selection

Subscribe with a public RSS or Atom URL under RSS & Atom subscriptions. Each refresh imports at most 40 previously unseen entries per feed. The source's preview is shown accurately as a preview; opening it fetches and saves the full article. Refresh is limited to once per 15 minutes per feed and runs on entering Articles or while that view is open. Removing a subscription preserves saved articles.

This week makes a personal selection from your uncompleted saved stories, with starred items first. It is not a community popularity ranking, generated summary, or email newsletter. Review links into your existing local highlight review system.

## Practical limits

Saved **text** is available offline; remote article images, video, scripts, and trackers are omitted. Extraction cannot access content behind a login or guarantee every publisher layout. Use Open original when needed. The app does not bypass paywalls. Pages are limited to 4 MB; private/local destinations and nonstandard ports are rejected. Publisher material remains subject to its own rights; the app's MIT license applies to code, not saved content.

No hosted newsletter mailbox, cross-device article sync, browser extension, or cloud AI is required or bundled. Those can be added as separate integrations without changing the local data model.

## Third-party code

- Mozilla Readability **0.6.0**, Apache-2.0: `Resources/Dashboard/Vendor/Readability-LICENSE.md`.
- DOMPurify **3.4.17**, offered under Apache-2.0 or MPL-2.0; use the Apache-2.0 option: `Resources/Dashboard/Vendor/DOMPurify-LICENSE`.
- jsdom is used only by development tests, not shipped as a runtime dependency.

## Rename compatibility

The project is read. and the app is `read.app`. The existing `app.shelf.dashboard` bundle identity, configuration directory, signing identity, old highlight IDs, and `shelf://` links are deliberately preserved. Changing them would disconnect macOS permissions, stored credentials, annotations, and existing update installations. Public project names, source modules, Xcode project, installer, repository, and Homebrew cask use the new name. Previous GitHub URLs redirect to `Somamill/read`; the Sparkle public key is unchanged.
