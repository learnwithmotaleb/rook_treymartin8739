---
name: Expo iOS modular headers
description: Required CocoaPods configuration for Clerk's Swift App Check dependencies in generated Expo iOS projects.
---

# Expo iOS Modular Headers

Enable global CocoaPods modular headers through an Expo config plugin whenever the app includes Clerk's iOS App Check dependency chain.

**Why:** `AppCheckCore` depends on `GoogleUtilities` and `RecaptchaInterop`, which otherwise do not expose module maps. CocoaPods then rejects the Swift pods when integrating static libraries during EAS/Expo Launch builds.

**How to apply:** Inject `use_modular_headers!` into the generated Podfile through a config plugin. Do not hand-edit or commit the generated `ios/` directory; Expo Launch regenerates it during each build.