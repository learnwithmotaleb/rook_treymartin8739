---
name: useColors web fix
description: Why useColorScheme() from react-native must not be called in this Expo web build.
---

`react-native-web`'s `useColorScheme` contains a `'use client'` directive and calls `React.useState` internally. In Metro's Expo web bundle this causes an "Invalid hook call" error due to a React reconciler mismatch — any component that calls `useColors()` crashes on web.

**Why:** The app uses a fixed dark-only theme (`userInterfaceStyle: "dark"` in app.json; both `light` and `dark` keys in `constants/colors.ts` are identical). So `useColorScheme()` has no functional effect.

**How to apply:** `hooks/useColors.ts` directly reads `colors.dark` without calling any React hooks. Do not add `useColorScheme()` or any other hook from `react-native` that delegates to `react-native-web` in this file.
