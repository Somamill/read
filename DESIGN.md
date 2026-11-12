# read. / dot.

Visual authority: `branding/dot/guidelines/identity.md` and the pinned `branding/dot/tokens.json` snapshot. This is an Operate interface with Read surfaces. People come here to choose something to read, continue reading, and keep highlights. Reading content takes priority over infrastructure.

Use the dot. system font, semantic warm light/dark palettes, read. brown accent, 4/8/12/16/24/32 spacing, 8-point controls and 16-point panels. Keep native Apple focus, keyboard, window and accessibility behavior. Preserve selected reading fonts and explicit OLED black. The suite vector marks are not replacement platform icons.

Primary navigation: Library, Articles, Highlights, Discover. More uses the native menu for statistics, operations, connections, activity, setup, updates, review, settings and Studio. Existing routes and shortcuts remain functional. No separate primary status dashboard is added.

`Scripts/build-dot-theme.py` generates desktop CSS, native JSON and iPhone TypeScript adapters from the shared kit. Run with `--check` in validation. `dot-ui.css` maps existing components to semantic roles and takes final precedence over historical styling. Keep reading text opaque; translucency is limited to floating navigation and selection tools. No decorative card hover lifts or perpetual animation. Respect reduced motion, reduced transparency and increased contrast.

About and Settings carry “Part of dot.” Companion links point to public project pages and do not imply installed apps, shared accounts or automatic data sharing. Existing app identifiers and private data locations are compatibility contracts.
