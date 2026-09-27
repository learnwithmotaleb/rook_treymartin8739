---
name: iOS build-number drift
description: Why a successful Expo Launch build may never appear in TestFlight, and how to keep build versions monotonic.
---

An Expo Launch workflow may successfully produce and sign an iOS build but fail when uploading to App Store Connect if Expo's remote build-number counter is behind Apple's latest accepted build. A failed upload means TestFlight remains on the old build; do not infer that the Launch wizard was never run from an unchanged TestFlight listing. Check the Launch failure log first.

**Why:** Apple rejected a signed Rook IPA with a lower bundle version than its existing TestFlight build even though the bundle ID and target App Store Connect app matched. A healthy API domain was unrelated. Changing only `ios.buildNumber` while remote versioning is enabled cannot fix this because Expo ignores the local number.

**How to apply:** Keep the build number above the latest Apple-uploaded number. When local EAS versioning is chosen to bridge drift, disable automatic increment and explicitly advance `ios.buildNumber` before **every** subsequent production upload; confirm the next Launch log reports the intended number before claiming success. Revisit the strategy if the managed Launch workflow ignores the source setting.