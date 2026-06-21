# Rook

A premium AI-powered identity protection mobile app that monitors for impersonators, stolen photos, data breaches, and threats across all major social platforms.

## Run & Operate

- `artifacts/mobile: expo` workflow — runs the Expo dev server (Expo Go compatible)
- Scan QR code from the Replit URL bar to test on a physical device via Expo Go
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54, React Native, expo-router (file-based routing)
- Fonts: Inter (400/500/600/700) via @expo-google-fonts/inter
- Icons: @expo/vector-icons (Ionicons, MaterialCommunityIcons, FontAwesome5, Feather)
- Animations: react-native-reanimated, react-native-svg (score ring)
- Gradients: expo-linear-gradient
- State: React Context (AppContext) + AsyncStorage for persistence
- Tab navigation: NativeTabs (iOS 26+ liquid glass) with ClassicTabs fallback

## Where things live

- `artifacts/mobile/` — main Expo app
- `artifacts/mobile/app/` — all screens (expo-router file-based)
- `artifacts/mobile/app/(tabs)/` — 5 tab screens: index, alerts, scan, tools, profile
- `artifacts/mobile/components/` — GlassCard, SecurityScoreRing, ThreatCard, ScanPulse, PlatformIcon
- `artifacts/mobile/context/AppContext.tsx` — global state, mock data, types
- `artifacts/mobile/constants/colors.ts` — dark cybersecurity theme (same for light+dark)
- `artifacts/mobile/hooks/useColors.ts` — color scheme hook (do not edit)

## Architecture decisions

- **Frontend-only**: All data is mock/simulated via AppContext + AsyncStorage. No backend required for first build.
- **Dark-only theme**: Both `light` and `dark` keys in colors.ts point to the same dark values. `userInterfaceStyle: "dark"` set in app.json.
- **SVG score ring**: SecurityScoreRing uses react-native-svg with AnimatedCircle + strokeDasharray for smooth animated arc.
- **ScanPulse**: Each PulseRing is a separate component (not rendered in a map) to avoid useAnimatedStyle in map patterns.
- **NativeTabs first**: Tab layout uses `isLiquidGlassAvailable()` to prefer native iOS 26 liquid glass tabs, falling back to BlurView tabs.

## Product

- **Dashboard**: Security score ring (72/100), shield status, 4 overview stats, connected accounts, recent alerts
- **Alerts**: Filterable threat feed (All/High/Medium/Low severity) with impersonator/breach/login/scam alerts  
- **Scan**: Radar pulse animation, active scan with progress, stats for monitored accounts
- **Tools**: AI Scam Analyzer, Photo Monitor, Recovery Hub, Dark Web Monitor, Premium upsell
- **Profile**: Avatar, connected accounts, settings, subscription status, logout
- **Detail screens**: Threat detail with AI analysis, Subscription paywall, Scam analyzer, Photo monitor, Recovery hub

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Web preview (Expo web) has known rendering differences vs native — trust Expo Go on device as source of truth
- Do not add `useAnimatedStyle` inside a `.map()` call — extract to a named component (see ScanPulse/PulseRing pattern)
- `colors.radius` is at the top level of colors.ts but available via `useColors()` because the hook spreads it in
- To force rescan (Metro errors): use `restart_workflow` tool, never `npx expo start` directly

## Pointers

- See the `expo` skill for Expo-specific guidelines
- See `pnpm-workspace` skill for monorepo structure
