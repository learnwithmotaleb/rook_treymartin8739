# Rook — App Store screenshot submission guide

This guide describes only screens and claims present in build 14. Capture
screenshots from the signed release candidate or a production-equivalent
review fixture. Do not use mockups, simulator-only evidence, stale fixture
counts, or screenshots of unavailable features.

## Device families

Upload screenshots for every iPhone device family enabled in App Store Connect.
Build 14 declares `supportsTablet: false`; do not prepare or upload iPad
screenshots unless that setting changes and the complete iPad audit is run.
Use App Store Connect's current size requirements for each selected iPhone
family rather than copying dimensions from this document.

## Recommended screenshots

1. **Dashboard** — loaded review fixture; score, alerts, account and photo
   context visible without hard-coding values in the caption.
2. **Alerts** — populated alert feed with the available severity filters.
3. **Threat detail** — selected potential threat with evidence, indicators,
   explanation, and official reporting guidance.
4. **Scan** — idle or active scan state with truthful progress and current
   account/photo context.
5. **Subscription** — current monthly/annual products, localized prices,
   disclosures, and Restore Purchases, captured from the actual StoreKit
   configuration.

## Capture checklist

- [ ] Capture from build 14 or the final signed build, not an older build.
- [ ] Use real, consented fixture data or a clean account; do not fabricate
      threats, scores, names, counts, or match percentages.
- [ ] Ensure all images, labels, prices, and loading states are settled.
- [ ] Remove debug overlays and developer menus.
- [ ] Confirm every visible claim also appears in the current app and legal
      disclosures.
- [ ] Do not include a Tools tab, AI Scam Analyzer, downloadable-report
      promise, or unsupported Meta permission.
- [ ] Verify final dimensions and device-family selection in App Store
      Connect immediately before upload.