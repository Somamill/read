# Reading views and commands

On Mac, press **⌘K** to find a page, save an article, open a saved view, or search your local library. On iPhone, use the search icon beside a page title.

In Articles, open **Reading views**, enter a filter and give it a name. The Mac shows a count next to each saved view. On iPhone, enter the query in Search articles, then save it under Reading views. Views are local to each device and included in its data backup.

Examples:

```text
is:unread read:<15
(tag:science OR tag:philosophy) -status:archive
author:"Martha Wells"
type:pdf OR type:article
saved:7d is:offline
domain:example.org
has:highlights
progress:>=50 -is:finished
```

Filters search local metadata. Full-text article search remains in the ordinary Mac article search field. Read-time filters need a known character count; previews without full content may not match. `saved:7d` means saved within seven days. Read-time values are minutes and progress values are percentages.

Use **Select articles** to choose multiple items. Finishing is an explicit progress change; moving completed items to the inbox resets their completion, matching the existing single-item action. Mac updates validate the entire selection before committing. Actions are bounded to 200 selected items.
