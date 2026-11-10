# read. for iPhone

A local-first React Native reader for **Expo Go SDK 58**. Import EPUBs, read saved articles, follow feeds, highlight passages and connect your own reading services.

[**Open the hosted iPhone preview in Expo Go**](exp://u.expo.dev/144f24a8-e646-4acd-a3e3-4226538e4c89?runtime-version=exposdk%3A58.0.0&channel-name=iphone-preview)

The hosted preview works with the Mac switched off. Your Calibre/KOSync servers must still be reachable for their own synchronization.

For local development:

```sh
npm ci
npx expo login
npx expo start --go
```

Use the same Expo account on the computer and in Expo Go. See the [mobile setup guide, feature matrix and publishing instructions](../../Documentation/IPHONE.md). This is an initial mobile preview; macOS-only integrations are not available in Expo Go.
