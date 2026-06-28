# Rook — Reviewer Test Script

**Version:** App Store & Meta App Review  
**App:** Rook — Identity Protection  
**Platform:** iOS (Expo / React Native)  

---

## Before You Begin

### Reviewer Credentials

| Field | Value |
|---|---|
| Email | `reviewer@tryrook.app` |
| Password | `RookReview2026!` |
| Account type | Pro (active subscription) |

> **Note for Meta reviewers:** A second clean account will be used for testing the Facebook/Instagram connection flow. See Step 19 for the OAuth flow.

### What the Account Contains

The reviewer account is pre-loaded with:
- Security score: **64/100**
- **4 active threat alerts** (1 High, 2 Medium, 1 Low)
- **3 connected social accounts** (Instagram, Facebook, X) + 1 pending (YouTube)
- **47 photos indexed** in the monitoring system
- **Pro subscription** active

---

## Step-by-Step Test Flow

### Step 1 — Launch the App
Open Rook from your home screen. The animated splash screen appears (Rook logo + loading animation).

**Expected:** Splash appears for ~2 seconds, then transitions to the auth screen.

---

### Step 2 — Sign In
Tap **"Sign In"** and enter the credentials above. Tap **"Continue"**.

**Expected:** Authentication succeeds. App transitions to the Dashboard tab.

---

### Step 3 — Dashboard Overview
Verify the Dashboard shows:
- Circular **Security Score ring** reading **64 / 100**
- **"4 Active Threats"** badge or count
- **3 connected account icons** (Instagram, Facebook, X) in the Connected Accounts section
- Stats: "47 Photos Indexed", "3 Accounts Monitored"

**Expected:** All stats visible within 2 seconds of landing on the tab.

---

### Step 4 — Open the HIGH Severity Threat
Scroll to the Recent Alerts section on the Dashboard and tap the threat card labelled **"Impersonator Detected on Instagram"** (red HIGH badge).

**Expected:** Threat Detail screen opens.

---

### Step 5 — Photo Comparison (Core Feature)
Scroll to the **Evidence** section on the Threat Detail screen.

Verify the **side-by-side photo comparison** is visible:
- **Left panel ("Yours"):** Your profile photo
- **Centre badge:** **91% match** (in red)
- **Right panel ("Theirs"):** The impersonator's profile photo — identical to yours

A second evidence item shows **28 posts reposted** with matching captions.

**Expected:** Both photos render clearly. The 91% match badge is visible between them.

> This is the primary demonstration of Rook's AI-powered identity protection value.

---

### Step 6 — AI Explanation & Score Breakdown
Scroll down past the evidence items to view:
- **AI Explanation** — plain-language description of the threat
- **Threat Score Gauge** — 91/100 "High Risk"
- **Score Breakdown bars** — Media Similarity, Content Reuse, Profile Similarity, etc.

**Expected:** All sections render. Score bars are animated.

---

### Step 7 — Report Account
Tap **"Report Account"** at the bottom of the screen.

**Expected:** A modal or in-app browser opens linking to Instagram's official account reporting guide.

---

### Step 8 — Alerts Tab
Navigate to the **Alerts** tab (bottom navigation).

Verify all 4 threats are listed:
- 🔴 HIGH — "Impersonator Detected on Instagram"
- 🟡 MEDIUM — "Username Impersonator on X"
- 🟡 MEDIUM — "Your Photo Reposted Without Credit"
- 🟢 LOW — "Suspicious Login Detected"

Also verify the severity filter pills are visible at the top (All / High / Medium / Low).

**Expected:** 4 threat cards displayed with correct severity badges.

---

### Step 9 — Severity Filter
Tap the **"Medium"** filter pill.

**Expected:** List narrows to 2 threats (both Medium severity).

---

### Step 10 — Stolen Photo Threat Detail
Tap **"Your Photo Reposted Without Credit"** (Facebook, Medium).

Verify the Evidence section shows:
- Your original photo vs. the reposted copy (**88% match**)
- Caption comparison showing text reuse

**Expected:** Photo comparison visible with 88% match badge.

---

### Step 11 — Start a Scan
Navigate to the **Scan** tab (bottom navigation). Verify:
- Radar pulse animation (concentric rings)
- Stats: "47 Photos Indexed", "3 Accounts Monitored", "3 Scans Completed"

Tap **"Start Scan"**.

**Expected:** Scan begins immediately. The radar animation intensifies. A progress indicator appears.

---

### Step 12 — Scan Progress
Watch the radar animation and progress bar. The scan runs against the reviewer's connected accounts (~20–40 seconds).

**Expected:** Progress bar advances. Step labels update ("Scanning Instagram...", etc.).

---

### Step 13 — Scan Result
Wait for the scan to complete. A result card appears.

**Expected:** Scan completes without crashing. Result card shows threats found or a clean "No new threats" confirmation.

---

### Step 14 — AI Scam Analyzer
Navigate to the **Tools** tab. Tap **"AI Scam Analyzer"**.

Paste the following into the input field:

> *"URGENT: Your Instagram account has been flagged for suspicious activity. Click here immediately to verify your identity and avoid suspension: http://insta-verify.net/confirm"*

Tap **"Analyze"**.

**Expected:** Risk analysis returns within ~5 seconds showing High Risk with explanation of phishing signals detected.

---

### Step 15 — Scam Analyzer Result
Review the risk score, flagged signals, and AI explanation on the result screen.

**Expected:** Result clearly labels this as a scam/phishing attempt. Explanation is plain-language and accurate.

---

### Step 16 — Photo Monitor
Tap the back arrow to return to Tools. Tap **"Photo Monitor"**.

**Expected:** Photo Monitor screen loads showing indexed photo count (47) and monitoring status.

---

### Step 17 — Profile Tab
Navigate to the **Profile** tab (bottom navigation).

Verify:
- Profile avatar (reviewer's profile photo)
- Name: Alex Rivera
- **"Pro"** subscription badge
- Connected Accounts section: Instagram ✓, Facebook ✓, X ✓, YouTube (pending)

**Expected:** All sections render correctly. Pro badge is visible.

---

### Step 18 — Connected Accounts Detail
Tap **"Connected Accounts"** in the Profile screen.

**Expected:** List shows 3 active accounts + 1 pending (YouTube). Each active account shows follower count and photos indexed.

---

### Step 19 — Connect Account [META REVIEWERS: Full OAuth Flow]

> **Apple App Store reviewers:** Tap "+ Connect Account", confirm the screen appears, then tap Cancel. Step complete.
>
> **Meta App Review reviewers:** Follow the full flow below.

#### Full Meta OAuth Flow

1. Tap **"+ Connect Account"**
2. Select **Instagram** from the platform list
3. The app opens an **in-app browser** showing Facebook's OAuth login screen
4. Log in with the **Meta test account credentials** (provided in the Meta review submission notes)
5. Review the permission request: **`instagram_business_basic`** — tap **"Allow"**
6. The browser closes automatically. The app shows **"Instagram Connected ✓"**
7. Repeat steps 1–6 for **Facebook**:
   - Select Facebook → browser opens → log in
   - Approve **`public_profile`** and **`user_photos`** permissions
   - App shows **"Facebook Connected ✓"**
8. Return to Profile → Connected Accounts — both accounts now appear active

**Expected:** Full OAuth flow completes without errors. Both accounts appear connected. No crash.

> **Why these permissions?**  
> `instagram_business_basic` — Rook uses this to verify the user is the legitimate owner of the connecting account and to build a photo fingerprint from their own media.  
> `user_photos` — Used to build a perceptual hash (dHash) fingerprint from the user's own Facebook photo library for impersonation detection. No photos are stored permanently — only computed hash values.

---

### Step 20 — Privacy Policy
From the Profile tab, scroll to the bottom and tap **"Legal & Privacy"** (or **"Privacy Policy"**).

**Expected:** In-app browser opens `https://tryrook.app/privacy`. Page loads correctly.

---

## Summary Checklist

| Step | Feature | Expected Result |
|------|---------|----------------|
| 3 | Dashboard | Score ring 64/100, 4 threats, 3 accounts |
| 4–5 | **Photo comparison** | Side-by-side with 91% match badge |
| 6 | AI explanation | Plain-language threat analysis visible |
| 7 | Report flow | Opens platform reporting guide |
| 8 | Alerts feed | 4 threats with severity badges |
| 9 | Severity filter | Medium filter narrows to 2 threats |
| 10 | Stolen photo detail | 88% match badge visible |
| 11–13 | Scan | Starts, progresses, completes without crash |
| 14–15 | Scam Analyzer | AI analysis returned, labels phishing correctly |
| 16 | Photo Monitor | Loads with 47 indexed |
| 17 | Profile | Pro badge, connected accounts visible |
| 19 | OAuth (Meta only) | Full Facebook/Instagram connect flow works |
| 20 | Privacy Policy | Opens correctly in browser |

---

*For support during review: support@tryrook.app*
