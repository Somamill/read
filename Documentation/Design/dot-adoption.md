# dot. adoption — 0.3.9 / iPhone 0.1.7

Shared kit 1.1.0 drives generated desktop CSS, native JSON and mobile TypeScript adapters. Library, articles, discovery, highlights, setup, connections and tools use one semantic surface/control vocabulary. Native reader automatic colors match the kit; selected fonts and explicit OLED remain available.

Four content destinations plus More replace the crowded taskbar. Secondary routes remain available for native menus and keyboard commands. Obsolete sidebar-only CSS and fourteen old paint-priority overrides were removed. Historical layout is isolated in a lower cascade layer rather than deleting functioning operational tools. App icon packages, identities, accounts and saved files are retained.

## Verification

- Dashboard: 21 tests, including module initialization, secondary route access and appearance behavior. Python: 116 tests, one skipped. Swift: 8 tests. iPhone: 29 tests plus typecheck and lint.
- Headless Chromium: 39 combinations across thirteen pages and three themes, plus narrow setup. No script errors or horizontal document overflow. A stubbed native bridge and local catalogue were used, so these checks do not establish native message delivery or iPhone behavior.
- Impeccable scanned changed CSS; this does not prove element contrast or native behavior. Hallmark's changed stylesheet scan has zero failures/warnings, one documented shared white-token waiver and two answered shared-component findings. Whole legacy CSS still has historical audit findings; it is not claimed clean.
- Release Mac build, installation and strict signature verification pass. Native inspection showed live covers and Apple Books data; final native inspection timed out. Final reader interaction and an on-device iPhone pass remain unverified.
- Calibre, KOSync and CrossPoint HTTP checks pass. Apple Books returns connected with 1,168 records. Four identifier-only unmatched positions remain unassigned; no position was fabricated.
- The legacy bridge was found waiting on an Xcode Python cache read. Its private login-job configuration was backed up and moved to an isolated cache; the installed app runtime is now used, and a completed recovery pass matched 36 records.

Run `python3 Scripts/build-dot-theme.py --check` after updates. Brand sync regenerates adapters in the same proposal; CI rejects stale generated files. Never infer live synchronization merely from a successful build.
