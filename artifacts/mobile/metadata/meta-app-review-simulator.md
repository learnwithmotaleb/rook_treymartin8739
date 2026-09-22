# Rook — Meta App Review Simulator Handoff

Use this handoff with the **iOS Simulator `.app`** produced by the
`meta-review` EAS profile. It is intentionally separate from the App Store
submission instructions: Meta needs the simulator bundle, not an `.ipa`.

## Build identity

| Field | Value |
| --- | --- |
| App | Rook — Identity Protection |
| Bundle identifier | `com.getrook.app` |
| Version | `1.0.0` |
| Build number | `2` |
| EAS profile | `meta-review` |
| Build target | iOS Simulator |
| API | `https://tryrook.app` |
| OAuth callback | `com.getrook.app://oauth` |

## Produced bundle

The tested EAS build is complete:

| Field | Value |
| --- | --- |
| EAS build | `e7ca6822-962d-4d0d-8855-dd414906cc3e` |
| Build page | https://expo.dev/accounts/treylane100/projects/rook/builds/e7ca6822-962d-4d0d-8855-dd414906cc3e |
| Download archive | https://expo.dev/artifacts/eas/nEiEcdi3_yCHN6MOwt3CvJGsx5YAfOSR20AYDHWML8g.tar.gz |
| Local bundle | `artifacts/mobile/meta-review-build/Rook.app` |
| Archive SHA-256 | `707e76644bbcef1a5e93b4229fc501022d1e0126c205fd765c01f9f93419c64d` |
| Bundle ID from `Info.plist` | `com.getrook.app` |
| Bundle version from `Info.plist` | `1.0.0 (2)` |
| Simulator SDK | `iphonesimulator26.0` |
| Architectures | arm64, x86_64 |

The extracted bundle is retained at the local path above for upload. If it is
not present in a fresh checkout, rerun the download command below; the EAS
artifact URL is also available from the build page.

For a future build, record the EAS build URL/ID and SHA-256 checksum of the
exact `Rook.app` archive supplied to Meta:

```text
EAS build URL/ID: ______________________________
SHA-256: _______________________________________
Built at (UTC): _________________________________
Simulator OS tested: ____________________________
```

## Build and package

Run from the repository root:

```bash
cd artifacts/mobile
pnpm run build:meta-review
pnpm run download:meta-review
find meta-review-build -maxdepth 2 -name 'Rook.app' -print
```

The download script selects the newest finished iOS build made with the
`meta-review` profile, extracts it, prints the EAS build ID and archive
SHA-256, and fails if the result does not contain an `.app`. The uploadable
bundle is the extracted `Rook.app` directory. Do not rename it to `.ipa`, do
not submit an App Store archive, and do not upload only the `.tar.gz` returned
by EAS. Keep the `.app` extension and preserve the bundle contents exactly as
downloaded.

## Local installation check (macOS with Xcode)

The Replit build host is Linux and cannot run an iOS Simulator. On a Mac,
boot a clean simulator and install the exact extracted bundle:

```bash
xcrun simctl list devices
xcrun simctl boot "iPhone 16"
open -a Simulator
xcrun simctl install booted /absolute/path/to/Rook.app
xcrun simctl launch booted com.getrook.app
```

Capture the simulator device/OS and checksum above only after this install
and launch check succeeds.

## Meta reviewer steps

1. Install `Rook.app` in an iOS Simulator.
2. Launch Rook. Sign in with the reviewer credentials supplied separately in
   Meta's **Instructions for reviewer** field. Do not place credentials in
   this repository.
3. If Clerk shows **Verify it's you**, enter the one-time six-digit code sent
   to the reviewer inbox.
4. Open **Profile → Connected Accounts → + Add Account → Instagram**.
   Sign in with the supplied Instagram Business or Creator test account,
   approve `instagram_business_basic`, and confirm that the browser closes and
   Instagram appears as connected.
5. Repeat **+ Add Account → Facebook**. Sign in with the supplied Facebook
   test account, approve `public_profile` and `user_photos`, and confirm that
   Facebook appears as connected. Open the media picker and verify the
   reviewer's own uploaded photos appear after photo-processing consent.
6. Open **Scan** and start a scan. Confirm the progress UI completes without
   a crash.
7. Open **Alerts**, open a threat, and verify the threat detail and report
   guidance screens.
8. Open **Profile → Legal & Privacy** and confirm the privacy page loads at
   `https://tryrook.app/privacy`.

### Permission scope honesty

The tested bundle requests these live scopes:

- Instagram: `instagram_business_basic`
- Facebook: `public_profile`, `user_photos`

The Facebook Meta app must have Advanced Access for `user_photos`. Reviewers
should be told only about the scopes present in the tested bundle.

## Submission checklist

- [ ] The extracted `Rook.app` installs on a clean iOS Simulator.
- [ ] Launch, Clerk sign-in, and the new-device verification path were checked.
- [ ] Instagram OAuth was checked with a Business or Creator test account.
- [ ] Facebook OAuth was checked with a Meta test account.
- [ ] The checksum and tested simulator OS were recorded above.
- [ ] Upload the exact tested `Rook.app` in Meta App Review.
- [ ] Add reviewer credentials and these steps to Meta's review notes.
- [ ] Submit only the requested permissions after the owner's final review.