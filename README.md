# Noethara Dev — Expo SDK 57

Native React Native recreation of the approved soft-ivory OpenCode-inspired UI, intended for personal testing in Expo Go on iPhone.

## Compatibility

- **Expo SDK 57** (matches Expo Go that reports SDK 57.0.0)
- React Native 0.86.3 and React 19.2.3
- Node.js 22.13 or later is recommended for Expo SDK 57.
- No development build is required for the current interface.

## Run in Cosyra (fresh install after upgrading from SDK 54)

Open the latest version of this repository and run:

```bash
git pull origin main
rm -rf node_modules package-lock.json .expo
npm install
npx expo install --check
npx expo start --clear --tunnel
```

If Cosyra automatically syncs the repo instead of using Git, skip `git pull`. If the --tunnel option is unavailable, start with `npx expo start --clear` and use the address Cosyra exposes.

Open the newly generated Expo Go link (not an old link cached from SDK 54).

You can run `npm run typecheck` and `npm run check` to validate your local setup.

## Interface features

- Soft ivory backgrounds, subtle gradient panels, hairline borders and shadows
- Animated orbital graphic and floating terminal icon
- Two-tone pixel OpenCode wordmark
- Multiline prompt, iPhone keyboard and coding shortcut toolbar
- Animated navigation drawer
- Terminals, Code and Files pages
- UI state transitions and native safe-area handling

## Implementation status

**Interface preview only.** No AI service or shell execution backend is connected. The status dot is the demo UI status, not proof of a remote server connection.

The UI was written in React Native + TypeScript, using react-native-svg, React Native Animated, expo-linear-gradient and Expo vector icons. The SDK 57 dependency versions have been aligned with Expo's SDK compatibility matrix.
