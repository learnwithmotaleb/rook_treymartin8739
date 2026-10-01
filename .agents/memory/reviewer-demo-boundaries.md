---
name: Reviewer demo boundaries
description: Why App Review uses the real screens with isolated sample data, and which operations must remain genuine.
---

The App Review account is a comprehensive product demo, not a separate feature tour. Reuse the shipped screens and controls with clearly marked sample data and session-local action previews. Do not enable Coming Soon integrations or invent capabilities for the demo.

**Why:** The creator explicitly wants the reviewer experience extremely close to the real app, with no shipped features omitted and no nonexistent features added. Fake OAuth verification or a separate simplified walkthrough would misrepresent what is being reviewed.

**How to apply:** Keep sample connections, media, findings, security state, and exports distinguishable from real data. Preview existing Premium controls independently of genuine entitlement, without changing the actual subscription tier.

Authentication, explicit Terms/age acknowledgements, and genuine StoreKit purchase/restore stay outside product-data simulation.

**Why:** Apple requested an initially expired subscription account to inspect purchasing. A mocked successful purchase or a free Premium grant would prevent that evaluation. Sample photo-consent controls do not authorize processing real photos.

**How to apply:** Disclose these exceptions in the reviewer instructions. Preserve sandbox entitlements across repeat sign-in and keep report/share outputs unmistakably illustrative.

Reviewer designation must use trusted authentication identity, never editable local profile email. Authorization failures must not silently select live mode.

**Why:** Profile editing and account-switch races can otherwise activate the wrong data source or apply an old continuation using a new account's credentials. A missing demo endpoint is not authoritative evidence that an account is an ordinary live account.

**How to apply:** Keep initialization account-scoped, invalidate stale continuations, and allow read-only bootstrap without incidental writes. Enforce the demo boundary for API-key owners and background jobs as well as interactive API requests.

Nullable display metadata must not prevent determining an authenticated account's mode.

**Why:** An existing reviewer had a null local profile email despite a valid trusted Clerk identity. Strict display-field validation rejected successful profile responses before authorization could run, leaving startup stuck. HTTP 200 alone did not establish a usable bootstrap.

**How to apply:** Normalize documented nullable display fields at the client boundary; keep identity, consent, role decisions, and malformed-data checks strict. Never infer reviewer status from the normalized display email.