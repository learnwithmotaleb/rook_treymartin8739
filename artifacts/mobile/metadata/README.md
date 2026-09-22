# Store Metadata

This directory contains store-ready copy for App Store and Google Play.

## Age Rating

**iOS (App Store Connect):**
Age rating is set in App Store Connect → App Information → Age Rating.
It CANNOT be configured in `app.json` or `Info.plist` — there is no Expo/EAS
config key for this. See `SUBMISSIONS.md` for the questionnaire boundary. The
result of the content questionnaire must not be confused with
Rook's account eligibility: the in-app signup, Terms, and Privacy notice
require users to be at least **17**. Rook does not provide unrestricted web
access.

**Android (Google Play Console):**
Content rating is set via the Play Console rating questionnaire. The result is
separate from Rook's **17+ minimum account eligibility**.
It CANNOT be set in the Android manifest or `app.json`. See `SUBMISSIONS.md`
for the questionnaire boundary and record the actual console result after
completion.

## Structure

```
metadata/
  ios/
    en-US/
      name.txt              — App name (30 chars max)
      subtitle.txt          — Subtitle (30 chars max)
      description.txt       — Full description (4000 chars max)
      keywords.txt          — Comma-separated keywords (100 chars max)
      promotional_text.txt  — Promotional text (170 chars max, updateable without review)
      release_notes.txt     — What's new in this version
      privacy_url.txt       — Privacy policy URL
      support_url.txt       — Support URL
  android/
    en-US/
      title.txt             — App title (50 chars max)
      short_description.txt — Short description (80 chars max)
      full_description.txt  — Full description (4000 chars max)
      release_notes.txt     — What's new
```

These files are compatible with Fastlane's `deliver` (iOS) and `supply` (Android) tools
for automated metadata uploads if CI/CD is set up in the future.
