# Rook — App Store Screenshots & Preview Video Guide

**Submitted to:** Apple App Store Connect  
**App name:** Rook — Identity Protection  

---

## Required Screenshot Sizes

Apple requires at least one screenshot set. Submit all three for maximum reach.

| Device | Screen Size | Resolution | Required? |
|--------|------------|-----------|---------|
| iPhone 16 Pro Max | 6.9" | 2868 × 1320 px | ✅ **Required** |
| iPhone 14 Plus / 13 Pro Max | 6.5" | 2778 × 1284 px | ✅ **Required** |
| iPad Pro 12.9" (6th gen) | 12.9" | 2048 × 2732 px | Optional but recommended |

> Tip: If you capture on the 6.9" simulator and 6.5" simulator, you cover both required sets.

---

## Required Screenshots (5 minimum)

Capture in this order for the most impactful sequence:

### Screenshot 1 — Dashboard
**Screen:** Home / Dashboard tab  
**State:** Fully loaded with reviewer account data  
**What should be visible:**
- Security score ring: **64 / 100** (in the ring's arc)
- "4 Active Threats" badge or count
- 3 connected account platform icons (Instagram, Facebook, X)
- Stats row: "47 Photos Indexed", "3 Accounts"
- At least 1–2 threat cards in the Recent Alerts section

**How to get there:** Log into the reviewer account → Dashboard tab loads automatically.

---

### Screenshot 2 — Alerts Feed
**Screen:** Alerts tab  
**State:** All threats visible (no filter active)  
**What should be visible:**
- 4 threat cards in the list
- 🔴 HIGH card at the top with red badge: "Impersonator Detected on Instagram"
- 🟡 MEDIUM × 2 below
- 🟢 LOW at bottom
- Severity filter pills at the top (All / High / Medium / Low)

**How to get there:** Tap the Alerts tab in the bottom navigation.

---

### Screenshot 3 — Threat Detail (THE MONEY SCREENSHOT)
**Screen:** Threat detail for the HIGH Instagram impersonator  
**State:** Evidence section visible — photo comparison in frame  
**What should be visible:**
- "Impersonator Detected on Instagram" heading
- Platform icon (Instagram) + "HIGH" severity badge
- **Evidence section with the side-by-side photo comparison:**
  - Left box labelled "Yours" — profile photo
  - Centre badge: **"91% match"** in red
  - Right box labelled "Theirs" — identical profile photo
- Ideally also: a second evidence item ("28 Posts Reposted") partially visible below

**How to get there:**  
Alerts tab → Tap "Impersonator Detected on Instagram" → Scroll to the Evidence section.

> **This is the screenshot that explains the app's core value in one glance.**  
> Make sure the photo comparison is centred and both images are fully loaded before capturing.

---

### Screenshot 4 — Scan Screen (Active State)
**Screen:** Scan tab  
**State:** Scan animation visible (either idle radar or mid-scan progress)  
**Option A (idle):** Radar pulse rings emanating outward, "Start Scan" button prominent  
**Option B (scanning):** Progress bar active, "Scanning Instagram..." step label visible  

**What should be visible:**
- Radar/pulse animation (Option A or B)
- Stats: "47 Photos Indexed", "3 Accounts Monitored"
- Clear call to action

**How to get there:**  
Tap the Scan tab → Optionally tap "Start Scan" and capture mid-progress (use Option B for more visual impact).

---

### Screenshot 5 — Tools Screen
**Screen:** Tools tab  
**State:** All 4 tool cards visible  
**What should be visible:**
- "AI Scam Analyzer" card
- "Photo Monitor" card
- "Recovery Hub" card
- Subscription/Premium upsell card (if on free tier) or "Dark Web Monitor" card

**How to get there:** Tap the Tools tab.

---

### Screenshot 6 — Subscription Paywall (Optional but recommended)
**Screen:** Subscription / Paywall screen  
**State:** Pro plan highlighted  
**What should be visible:**
- Plan comparison (Free vs Pro vs Premium)
- Pro plan features listed
- "Start Free Trial" or "Upgrade" CTA button

**How to get there:** Profile tab → "Upgrade Plan" or tap any premium-gated feature.

---

## How to Capture Screenshots

### Using Xcode Simulator (Recommended)

1. Install Xcode from the Mac App Store (free)
2. In this repo, run: `pnpm --filter @workspace/mobile run dev`
3. In Expo Dev Tools, press `i` to open iOS Simulator
4. Select the simulator device: **iPhone 16 Pro Max** for 6.9" screenshots
5. Navigate to the desired screen
6. Wait for all images and animations to fully load
7. In the menu bar: **File → Save Screen**  
   Or press `Cmd + S` in the simulator window
8. Screenshots save to `~/Desktop` at the correct resolution automatically

### Switching to 6.5" Screenshots
1. In Simulator menu: **File → Open Simulator → iPhone 14 Plus** (or 13 Pro Max)
2. Repeat the same screens in the new simulator
3. Screenshots from this device will be at 2778 × 1284 px

### Screenshot Order Recommendation
Capture in this order so the reviewer account state is consistent:
1. Launch app → log in → Dashboard (Screenshot 1)
2. Alerts tab (Screenshot 2)
3. Tap HIGH threat → scroll to Evidence → photo comparison (Screenshot 3)
4. Back → Scan tab, tap Start Scan → mid-progress (Screenshot 4)
5. Tools tab (Screenshot 5)
6. Profile → Upgrade Plan (Screenshot 6, optional)

---

## App Preview Video (Optional — Highly Recommended)

Apple allows up to **3 preview videos** per device size. A 15–30 second video significantly increases conversion on the App Store listing.

### Spec
| Property | Value |
|----------|-------|
| Duration | 15–30 seconds |
| Format | H.264 or HEVC .mov |
| Resolution | Matches screenshot size (e.g. 2868 × 1320 for 6.9") |
| Audio | Optional (most users watch muted) |

### Recommended Sequence (28 seconds)

| Seconds | Screen | What's Happening |
|---------|--------|-----------------|
| 0–3 | Dashboard | Score ring animates in, threat badges visible |
| 3–7 | Threat Detail | Tap HIGH threat → photo comparison appears with 91% badge |
| 7–10 | Threat Detail | Scroll to show AI explanation |
| 10–13 | Alerts tab | Swipe back → Alerts tab → filter taps |
| 13–18 | Scan tab | Tap Start Scan → radar animation → progress bar |
| 18–21 | Scan result | Result card slides in |
| 21–25 | Tools tab | Scroll through tool cards |
| 25–28 | Profile | Profile tab shows Premium badge + connected accounts |

### How to Record
1. In Xcode Simulator: **Window → Video Recording** (⌘R)
2. Walk through the sequence above
3. Stop recording: click the red circle in the menu bar or ⌘R again
4. Video exports to `~/Desktop` as a `.mov` file
5. Upload to App Store Connect under each device size's **App Previews** section

---

## Uploading to App Store Connect

1. Log in at [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Select **Rook** → **App Store** → **iOS App**
3. In the **App Previews and Screenshots** section:
   - Select **"6.9-inch (iPhone 16 Pro Max)"** tab → upload 5–6 screenshots
   - Select **"6.5-inch (iPhone 14 Plus)"** tab → upload the same 5–6 screenshots
4. Drag to reorder so Screenshot 3 (photo comparison) is second or third in the sequence
5. Optionally upload the preview video under **App Previews**
6. Save

---

## Screenshot Quality Checklist

Before uploading, verify each screenshot:

- [ ] Status bar is clean (time shows 9:41, no low-battery, no carrier name)
  - Simulator → Features → Toggle In-Call Status Bar (to hide)
  - Or use SimulatorStatusMagic for a clean status bar
- [ ] All images have fully loaded (no grey placeholders)
- [ ] Animations have settled (no mid-transition states)
- [ ] Screenshot 3: both photos in the comparison are visible (not loading)
- [ ] No debug overlays, no React Native developer menu visible
- [ ] Resolution matches the required device size exactly
