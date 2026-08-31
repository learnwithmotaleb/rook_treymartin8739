---
name: EAS simulator builds
description: Constraints and reliable packaging flow for iOS Simulator artifacts in this workspace
---

An iOS Simulator `.app` must be built by EAS with an authenticated Expo personal
access token; the Linux workspace cannot launch Apple’s Simulator or run
`simctl`.

**Why:** The workspace has no Xcode toolchain, while the EAS CLI may be older
than current documentation and may prepend log lines to JSON or omit a
download command.

**How to apply:** Use a dedicated simulator profile with the production API
URL, query the finished build for its artifact URL, extract the archive, and
validate `Info.plist`, simulator Mach-O architectures, and the embedded public
configuration. Complete install/OAuth smoke testing on a Mac before upload.