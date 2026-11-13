# Repository artwork

Original promotional artwork generated with the built-in image generation tool on 2026-11-09. These are editorial brand illustrations, not app screenshots or representations of device connectivity. Existing demo-interface images are labelled separately in the main README.

## Files

- `read-hero.jpg`: warm paper README hero, 1600 × 800; generated from the current icon.
- `read-features.jpg`: Books / Articles / Highlights identity panel, 1600 × 800; generated from the current icon.
- `read-social-preview.jpg`: 1280 × 640 social preview, generated from the current icon, uploaded in GitHub repository Settings → Social preview. Matches GitHub's recommended aspect ratio and stays below its 1 MB limit.

JPEG exports keep page downloads small. Original PNG generations remain in the creator's local generated-image archive; the final project assets are all present here. The app icon and application bundle are unchanged. No personal books, credentials, screenshots or third-party logos were used.

## Prompt set

### Hero and social preview

Use case: ads-marketing. Create a polished wide landscape GitHub repository hero banner, about 2:1 aspect ratio, 1280 by 640 composition. Brand: read., a minimalist free open-source macOS app for EPUB books, offline articles, RSS and highlights. Art direction: premium restrained Apple-adjacent editorial product photography, not a UI mockup. A sculptural open white paper book seen at a shallow overhead angle, its two page wings gently rising upward from the central spine like a book lying on a table. A few thin translucent glass sheets floating behind it suggest articles and highlighted passages without readable interface details. Crisp warm ivory paper against a deep ink-black background, subtle cool silver reflections, one tiny muted blue accent, no pink or purple. Composition: beautiful book sculpture occupies right half; generous negative space left, perfectly typeset white 'read.' wordmark large with period, small line below exactly 'Books. Articles. Your space.' and a discreet small bottom-left line exactly 'Free & open source for macOS'. Strong visual hierarchy, exquisite soft studio light, subtle grain, legible clean sans-serif typography. All content comfortably inside safe margins. No device frames, no fake app screenshot, no other logos, no badges, no watermarks.

### Feature illustration

Use case: ads-marketing. Asset type: wide editorial feature artwork for the GitHub README of 'read.', a free open-source macOS reader. Create an elegant wide 2:1 landscape composition, coordinated with premium black/ivory minimalist branding. Three evenly spaced tactile sculptural still lifes on a luminous warm-white studio background with generous whitespace: left an open ivory paper book lying flat, page wings rising upward from its spine; middle two very thin translucent glass article sheets with tasteful abstract gray text lines; right a small paper passage card with a single delicate muted-blue highlighted line and a pencil beside it. Soft physically plausible shadows, beautifully rendered paper and frosted glass, calm Apple-like product editorial aesthetic, very restrained blue accents, no pink, no purple, no device frames and no fake UI screens. Place clean dark sans-serif headings under each object, exactly 'Books', 'Articles & RSS', and 'Highlights'. A small discreet 'read.' wordmark at bottom left. Keep all objects and labels comfortably inside safe margins. This is conceptual promotional artwork, not an app screenshot. No third-party logos, no books with commercial cover art, no badges, no watermarks.

## Discoverability

The repository description and topics describe implemented features. README headings, alt text, direct download links and a live release badge support readable and searchable project information; no search ranking or traffic increase is guaranteed. Update the social preview manually in GitHub settings when replacing this artwork.

Reference: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview

## Open-book identity

The app-owned source is `branding/read/icon.json`; colors come from `branding/dot/tokens.json`. The raised page edges preserve a legible silhouette at small sizes. The warm paper tile references listen.’s restrained native tile; the compact mark follows Immersed’s clear silhouette. Shared suite snapshots remain unchanged.

Regenerate every export on macOS with `python3 Scripts/build-icon-assets.py`. Run `python3 Scripts/build-icon-assets.py --check` on any platform to detect drift. macOS uses its normal transparent outer margin; the mobile image is opaque and full bleed so the operating system supplies the mask. Expo Go uses its own installed app icon; a standalone build is needed to replace the iPhone Home Screen icon.
