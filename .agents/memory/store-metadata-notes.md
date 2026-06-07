---
name: Store metadata notes
description: Dark web monitor removed; iOS keyword limit; metadata file locations for App Store / Google Play
---

# Store Metadata Notes

## Rule
Dark Web Monitor was removed from the app (darkweb.ts, breachMonitorService.ts deleted). **Never re-introduce "Dark Web Monitor" in any store metadata, description, or feature list.**

**Why:** The HIBP integration was removed in Task #12/#13. Advertising a feature that doesn't exist would violate App Store / Play Store guidelines and mislead users.

**How to apply:**
- When updating `metadata/ios/en-US/description.txt` or `metadata/android/en-US/full_description.txt`, use "Identity Fingerprint" instead of "Dark Web Monitor"
- iOS `keywords.txt` has a **100-character hard limit** (comma-separated, no spaces after commas). Current value is 88 chars — keep under 100.
- Support URL endpoint is `/api/legal/support` (added to `artifacts/api-server/src/routes/legal.ts`)
- Privacy URL is `/api/legal/privacy`, Terms is `/api/legal/terms`

## File locations
- `artifacts/mobile/metadata/ios/en-US/` — App Store Connect copy
- `artifacts/mobile/metadata/android/en-US/` — Google Play copy
- `artifacts/mobile/metadata/SUBMISSIONS.md` — full step-by-step build + submission guide
- `artifacts/mobile/eas.json` — EAS build profiles (fill in Apple ID / team ID before submitting)
