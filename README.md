# Noethara Dev — Expo mobile UI

A native React Native recreation of the approved soft-ivory OpenCode/Cosyra-inspired mobile mockup, built as a **personal, offline-safe interface prototype**.

## Run on iPhone (Expo Go)
This project deliberately targets **Expo SDK 54**, because the App Store build of Expo Go for iOS supports SDK 54.

1. Clone or open this repo in Cosyra.
2. Run **npm install**.
3. Run **npx expo start --tunnel** if the phone cannot connect via LAN, or **npm start** on a shared network.
4. Open the QR/link in **Expo Go**.
5. Run **npm run typecheck** to check TypeScript and **npx expo install --check** to check dependencies.

## Included
- Native ivory gradients, soft panels, hairline borders and shadows
- Animated orbital rings, floating terminal tile and pixel-drawn two-tone OpenCode logo
- Multiline composer, native keyboard and functional coding-accessory shortcut bar
- Animated drawer with Terminals / Code / Files navigation
- Terminal/project overview, chat UI preview, files empty state
- UI transitions, mode/model selectors, tip card and terminal footer

## Not connected yet
This is the front-end milestone. No AI service or coding backend is attached; buttons do not execute shell commands or push to GitHub. The dot displays local demo state, not a live cloud connection.

## Stack
Expo SDK 54 · React Native · TypeScript · React Native Animated · react-native-svg · expo-linear-gradient.
