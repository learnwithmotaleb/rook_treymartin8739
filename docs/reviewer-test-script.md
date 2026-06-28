# Rook — Reviewer Test Script

**Version:** App Store & Meta App Review  
**App:** Rook — Identity Protection  
**Platform:** iOS (Expo / React Native)  

---

## Before You Begin

### Reviewer Credentials

Use the credentials provided separately by the Rook team in the App Review notes.

| Field | Value |
|---|---|
| Email | `reviewer@tryrook.app` |
| Password | *(provided in App Review notes)* |
| Account type | Pro (active subscription) |

> **Note for Meta reviewers:** A separate account will be provided for testing Facebook/Instagram connection. See Step 19 for the OAuth flow.

### What You'll See

The reviewer account is pre-loaded with:
- Security score: **64/100**
- **4 active threat alerts** (1 High, 2 Medium, 1 Low)
- **3 connected social accounts** (Instagram, Facebook, X)
- **47 photos indexed** in the monitoring system
- **Pro subscription** active

---

## Step-by-Step Test Flow

### 1 — Launch the App
Open Rook from your home screen. You'll see the animated splash screen (Rook logo + loading animation).

**Expected:** Splash appears for ~2 seconds, then transitions to the auth screen.

---

### 2 — Sign In
Tap **"Sign In"**. Enter the reviewer credentials listed above. Tap **"Continue"**.

**Expected:** Authentication succeeds, app transitions to the Dashboard tab.

---

### 3 — Dashboard Overview
The Dashboard loads with:
- A circular **Security Score ring** showing **64 / 100**
- A **"4 Active Threats"** badge
- **3 connected account icons** (Instagram, Facebook, X) in the Connected Accounts section
- Stats: "47 Photos Indexed", "3 Accounts Monitored"

**Expected:** All stats visible within 2 seconds of landing on the tab.

---

### 4 — Open the HIGH Severity Threat
Scroll to the Recent Alerts section on the Dashboard and tap the threat card labelled **"Impersonator Detected on Instagram"** (red HIGH badge).

You can also reach this via the **Alerts tab** → tap the first threat card.

**Expected:** Threat Detail screen opens.

---

### 5 — Photo Comparison (Core Feature Demonstration)
On the Threat Detail screen, scroll to the **Evidence** section.

You will see a **side-by-side photo comparison**:
- **Left panel ("Yours"):** Your profile photo
- **Centre badge:** **91% match**
- **Right panel ("Theirs"):** The impersonator's profile photo — identical to yours

A second evidence item shows **28 posts reposted** with matching captions.

**Expected:** Both photos render clearly. The 91% match badge is visible between them.

> This is the primary demonstration of Rook's AI-powered identity protection value.

---

### 6 — AI Explanation & Score Breakdown
Scroll down past the evidence items to see:
- **AI Explanation** — a plain-language description of why this is flagged as an impersonator
- **Threat Score Gauge** — 91/100 "High Risk"
- **Score Breakdown bars** — Media Similarity, Content Reuse, Profile Similarity, etc.

**Expected:** All sections render. Score bars are animated.

---

### 7 — Report Account Flow
Tap **"Report Account"** at the bottom of the screen.

**Expected:** A modal or in-app browser opens linking to Instagram's official account reporting guide.

---

### 8 — Return to Alerts Tab
Tap the back arrow to return. Navigate to the **Alerts** tab (bottom navigation).

**Expected:** All 4 threats are listed:
- 🔴 HIGH — "Impersonator Detected on Instagram"
- 🟡 MEDIUM — "Username Impersonator on X"  
- 🟡 MEDIUM — "Your Photo Reposted Without Credit"
- 🟢 LOW — "Suspicious Login Detected"

---

### 9 — Filter by Severity
Tap the **"Medium"** filter pill at the top of the Alerts tab.

**Expected:** List narrows to 2 threats (both Medium severity alerts).

---

### 10 — Open the Stolen Photo Threat
Tap **"Your Photo Reposted Without Credit"** (Facebook, Medium).

On the Threat Detail screen, the Evidence section shows:
- Your original photo vs. the reposted copy (88% match)
- Caption comparison showing text reuse

**Expected:** Photo comparison visible with 88% match badge.

---

### 11 — Go to Scan Tab
Tap the **Scan** tab in the bottom navigation bar. You'll see:
- A **radar pulse animation** (concentric rings emanating from centre)
- Stats: "47 Photos Indexed", "3 Accounts Monitored", "3 Scans Completed"
- A **"Start Scan"** button

Tap **"Start Scan"**.

**Expected:** Scan begins immediately. The radar animation intensifies. A progress indicator appears.

> **Note:** This account performs a real scan against your connected accounts. The scan takes approximately 20–40 seconds to complete. This demonstrates Rook's active monitoring capability.

---

### 12 — Scan Completes
Wait for the scan to finish. A result card appears showing:
- Threats found during this scan (if any new ones)
- Or a "No new threats found" confirmation card

**Expected:** Scan completes without crashing. Result card is displayed.

---

### 13 — Tools Tab — AI Scam Analyzer
Tap the **Tools** tab. Tap **"AI Scam Analyzer"**.

On the Scam Analyzer screen, paste this sample text into the input field:

> *"URGENT: Your Instagram account has been flagged for suspicious activity. Click here immediately to verify your identity and avoid suspension: http://insta-verify.net/confirm"*

Tap **"Analyze"**.

**Expected:** Risk analysis appears within ~5 seconds showing High Risk with explanation of phishing signals detected.

---

### 14 — Photo Monitor
Tap the back arrow. Tap **"Photo Monitor"** from the Tools screen.

**Expected:** Photo Monitor screen loads showing indexed photo count (47) and monitoring status.

---

### 15 — Profile Tab
Tap the **Profile** tab (bottom navigation).

You'll see:
- Profile avatar (reviewer photo)
- Name: Alex Rivera
- **"Pro"** subscription badge
- Connected Accounts section: Instagram ✓, Facebook ✓, X ✓, YouTube (pending)

**Expected:** All sections render correctly. Pro badge is visible.

---

### 16 — Connected Accounts Detail
Tap **"Connected Accounts"** in the Profile screen.

**Expected:** List shows 3 active accounts + 1 pending (YouTube). Each shows follower count and photos indexed.

---

### 17 — Privacy Policy
Scroll to the bottom of the Profile screen. Tap **"Privacy Policy"** (or "Legal & Privacy").

**Expected:** In-app browser opens `https://tryrook.app/privacy`. Page loads.

---

### 18 — Delete Account Option
Verify that a **"Delete Account"** option is present (usually at the bottom of Settings or Profile).

**Expected:** Option is present and tappable. Tapping it shows a confirmation dialog (do not confirm — this would delete the reviewer account).

---

### 19 — Connect Social Account [META REVIEWERS ONLY]

> **Skip this step if you are an Apple App Store reviewer.**

To test the Facebook and Instagram OAuth flows:

1. From the Profile tab, tap **"Connected Accounts"**
2. Tap **"+ Connect Account"** (or tap the **"+"** icon)
3. Select **Instagram** from the platform list
4. The app opens an in-app browser showing **Facebook's OAuth login screen**
5. Log in with the **Meta test account credentials** (provided separately)
6. Review the permission request: `instagram_business_basic` — tap **"Allow"**
7. The browser closes automatically. The app shows **"Instagram Connected ✓"**
8. Repeat steps 2–7 for **Facebook** (permissions: `public_profile`, `user_photos`)
9. Return to Profile → Connected Accounts shows both accounts as active

**Expected:** Full OAuth flow completes without errors. Both accounts appear connected.

> **Why these permissions?** Rook uses `instagram_business_basic` to verify the user is the legitimate owner of the connecting account, and to build a photo fingerprint from the user's own media. `user_photos` (Facebook) is used to build a perceptual hash (dHash) fingerprint for impersonation detection. No photos are stored permanently — only computed hash values.

---

## Summary Checklist

| Step | Feature | Expected Result |
|------|---------|----------------|
| 3 | Dashboard | Score ring, threat count, connected accounts visible |
| 5 | **Photo comparison** | Side-by-side photos with 91% match badge |
| 6 | AI explanation | Plain-language threat analysis visible |
| 8 | Alerts feed | 4 threats listed with severity badges |
| 9 | Severity filter | Filters work correctly |
| 11 | Scan animation | Radar pulses, scan starts |
| 12 | Scan completion | Result card appears, no crash |
| 13 | Scam Analyzer | AI analysis returned within 5 seconds |
| 15 | Profile | Pro badge, connected accounts visible |
| 17 | Privacy Policy | Opens correctly in browser |
| 19 | OAuth (Meta only) | Full Facebook/Instagram connect flow works |

---

*For support during review, contact: support@tryrook.app*
