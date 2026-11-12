# Readwise functionality research and local implementation

Research date: 12 November 2026. The requested reference is https://readwise.io/read. This implementation is read.'s own MIT-licensed code; no Readwise application source or artwork is included.

## Evidence and coverage

REA launched a temporary Chromium profile, opened the public Reader landing page and download page, and captured their DOM/accessibility. Both owned browsers were terminated. These observations establish the public pages and download links, not authenticated Reader behavior. No private account, paywall, subscription flow, API credential or user library was accessed.

REA parent evidence: `ev_ae88e4d15c1001fd99be06c139b0e369483e358f1a08de3e0c2eaf9e400995af` (Reader page), `ev_3643472be6e7a7492b626e14b33ade6b6cc3cec4475a43f552e747ecdb68a371` (download page). Public download links identify a universal Mac DMG and Windows installer; the binaries were not downloaded or decompiled. iOS, Android and browser-extension internals remain unobserved.

Primary references: [Reader](https://readwise.io/read), [basics and command palette](https://docs.readwise.io/reader/docs/faqs), [filtered views](https://docs.readwise.io/reader/docs/faqs/filtered-views), [action tags](https://docs.readwise.io/reader/docs/faqs/action-tags), [highlights and notes](https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes), [navigation](https://docs.readwise.io/reader/docs/faqs/navigation).

## Feature map

| Capability | read. implementation and limits |
| --- | --- |
| Articles, EPUBs and PDFs | Existing local article extraction, Calibre EPUB reader and PDF text preparation. Protected/login-only content still needs an authorized readable source. |
| RSS and reading inbox | Existing subscriptions, duplicate URL handling, cached text, thumbnails and feed discovery. |
| Saved filtered views | Added local named article queries with counts; the same bounded parser ships on Mac and iPhone. Supports Unicode phrases, AND/OR/NOT, grouping, type, author, title, tag, status, star/offline state, domain/source/feed, estimated read time, percentage and relative saved dates. |
| Keyboard-oriented operation | Added Mac Cmd/Ctrl+K command menu with existing pages, article capture, saved views and local book search. Native menus and shortcuts remain available. |
| Mobile unified search | Added local metadata search and action navigation, using the same query semantics. |
| Inbox processing | Added explicit multi-select and bulk finish/later/star actions on Mac; iPhone supports bulk finish/inbox, tags and stars. Mac changes validate the whole selection in one database transaction. |
| Highlights and notes | Existing independent local highlight library, tagging, notes and import/export. Readwise remains an optional connector. |
| Daily review | Existing offline review queue, scheduling, collections and user-selected review intervals. Dedicated Q&A/cloze mastery cards are not part of this release. |
| Speech and reading presentation | Existing system speech, font controls, chapter navigation, paginated/spread/scroll layouts on Mac, and paginated/scroll on mobile. Native/Expo capabilities differ. |
| Export and integrations | Existing Markdown/JSON/CSV-style exports, Apple Notes/Notion paths and optional reading-service connections. Export behavior depends on the selected destination. |
| Newsletter email addresses | Hosted inbound email aliases are not implemented; RSS and ordinary readable newsletter URLs are supported. A receiving mail service needs a separate integration and credentials. |
| Browser web highlighting | Local reader highlighting is implemented; a distributable browser extension is a separate deliverable. |
| Video/threads | Ordinary readable page extraction is present. Timestamped YouTube transcript reading and reliable authenticated thread extraction are not implemented. |
| Ghostreader-style AI | Existing optional Studio providers can use configured services. A model or cloud account is required for generative features; no paid AI service is made mandatory. |
| Shared accounts and cross-device views | Existing configured book/progress sync is retained. Saved views are local to each client and included in its data backup; automatic saved-view synchronization is not claimed. |

## Design decisions

Keep the dot. content-first interface rather than reproducing Reader's branding. Use views as reusable queries, not duplicate copies of documents. Treat bulk finish as an explicit reading-state change. Keep malformed filters visible as useful errors; never evaluate query text as JavaScript or SQL. Persist original documents, highlights and identifiers.

## Runtime check discovered during the audit

The existing bridge repeatedly launched Docker for individual Redis fields. A bounded read-only snapshot now retrieves all fields in one call, preserving matching and metadata. A live snapshot read 60 records in 0.12 seconds. The local container runtime also required recovery; a completed bridge pass afterward matched 36 records. Container health alone is not proof of sync completion.
