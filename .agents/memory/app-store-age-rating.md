---
name: App Store age rating
description: How Apple’s age-rating questionnaire treats Rook’s restricted OAuth web views.
---

Rook’s social-provider OAuth pages are restricted authorization flows, not unrestricted web access. Set unrestricted web access to false; with objectionable-content answers at none/false, Apple calculates a 4+ rating.

**Why:** Marking unrestricted web access true caused App Store Connect to calculate a 17+ rating even though Rook does not contain a general-purpose browser.

**How to apply:** Keep unrestricted web access false unless Rook later adds a browser that lets users navigate arbitrary websites. Re-check the calculated rating after any questionnaire change.