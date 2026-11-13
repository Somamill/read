# read. for iPhone

The standalone React Native app imports EPUBs, reads saved articles, follows feeds, stores highlights and connects to user-selected reading services. It uses Expo SDK 58 as its build framework; Expo Go distribution is no longer maintained.

Install dependencies with `npm ci`. For a local native build use `npx expo run:ios`; local compilation requires Xcode. End users install a signed app and do not need Xcode, Node or Expo Go. Production and internal Store builds are defined in `eas.json`; see [Store packaging](../../Documentation/APP_STORE.md).

See the [iPhone guide](../../Documentation/IPHONE.md) for connections and feature limits. The Mac-only background integrations remain separate.
