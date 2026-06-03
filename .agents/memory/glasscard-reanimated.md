---
name: GlassCard reanimated web crash
description: GlassCard must not call reanimated hooks (useSharedValue, useAnimatedStyle) at the top level — they must live in a PressableCard sub-component rendered only when pressable.
---

**Rule:** Never call `useSharedValue` or `useAnimatedStyle` directly inside `GlassCard`. Put them in a `PressableCard` sub-component that only renders when `pressable || onPress` is truthy.

**Why:** On web, react-native-reanimated uses a different React renderer than React DOM. Calling reanimated hooks unconditionally (even when animation is unused) causes "Invalid hook call" crashes in the Expo web bundle, taking down any screen that renders a non-pressable GlassCard (e.g., ThreatCard in the Alerts screen).

**How to apply:** The current `GlassCard.tsx` has `PressableCard` as a local sub-component. Keep this pattern. Do not merge the animation hooks back into `GlassCard` directly.
