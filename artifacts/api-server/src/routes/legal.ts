import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const publicLegalRouter: IRouter = Router();

const DOMAIN = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim()
  ?? process.env["REPLIT_DEV_DOMAIN"]
  ?? "getrook.app";

const APP_NAME = "Rook";
const CONTACT_EMAIL = "support@getrook.app";
const SUPPORT_EMAIL = "support@getrook.app";
const PRIVACY_EMAIL = "privacy@getrook.app";
const BUSINESS_PHONE = "+1 (832) 819-3114";
const BUSINESS_ADDRESS = "127 N Higgins Ave Suite 307D #2992, Missoula, MT 59802";
const BUSINESS_NAME = "Rook Identity Labs LLC";
const LAST_UPDATED = "August 10, 2026";
const TERMS_VERSION = "2026-08-10-v2";

const html = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — ${APP_NAME}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           background: #0a0f1e; color: #e2e8f0; line-height: 1.7; }
    .container { max-width: 760px; margin: 0 auto; padding: 60px 24px 80px; }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 48px; }
    .logo-mark { width: 44px; height: 44px; object-fit: contain; }
    .logo-name { font-size: 20px; font-weight: 700; color: #f8fafc; }
    h1 { font-size: 32px; font-weight: 800; color: #f8fafc; margin-bottom: 8px; }
    .meta { color: #64748b; font-size: 14px; margin-bottom: 48px; }
    h2 { font-size: 18px; font-weight: 700; color: #f8fafc; margin: 36px 0 12px; }
    h3 { font-size: 15px; font-weight: 600; color: #cbd5e1; margin: 20px 0 8px; }
    p { color: #94a3b8; margin-bottom: 14px; }
    ul { color: #94a3b8; margin: 0 0 14px 20px; }
    li { margin-bottom: 6px; }
    a { color: #3B82F6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .card { background: #131929; border: 1px solid #1e2d4a; border-radius: 14px;
            padding: 24px; margin: 24px 0; }
    .notice-box { background: #1a1030; border: 1px solid #4c1d95; border-radius: 12px;
                  padding: 20px 24px; margin: 20px 0; }
    .notice-box h3 { color: #a78bfa; margin-top: 0; }
    .footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid #1e2d4a;
              color: #475569; font-size: 13px; }
    .footer a { color: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img class="logo-mark" src="/landing/logo.png" alt="Rook" />
      <span class="logo-name">${APP_NAME}</span>
    </div>
    ${body}
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME} &nbsp;·&nbsp;
      <a href="/privacy">Privacy Policy</a> &nbsp;·&nbsp;
      <a href="/terms">Terms of Service</a> &nbsp;·&nbsp;
      <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a>
    </div>
  </div>
</body>
</html>`;

function servePrivacy(_req: Request, res: Response) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html("Privacy Policy", `
    <h1>Privacy Policy</h1>
    <p class="meta">Last updated: ${LAST_UPDATED} &nbsp;·&nbsp; Version ${TERMS_VERSION}</p>

    <p>${APP_NAME} ("we", "our", "us") is an AI-powered identity protection service operated by <strong>${BUSINESS_NAME}</strong>. This Privacy Policy explains how we collect, use, share, and protect your information, and what rights you have over that information.</p>

    <p><strong>Independent Service.</strong> ${APP_NAME} is not affiliated with, endorsed by, or connected to Meta, Instagram, Facebook, Google, X (Twitter), TikTok, Snapchat, LinkedIn, YouTube, Apple, or any other platform we search or integrate with. All trademarks belong to their respective owners.</p>

    <h2>1. Information We Collect</h2>
    <ul>
      <li><strong>Account information:</strong> Name, email address, and username at registration. Authentication is managed by <strong>Clerk</strong> — we receive a secure user identifier and basic profile info; we never receive or store your password.</li>
      <li><strong>Connected platform data:</strong> When you authorize ${APP_NAME} to access a social platform, we receive read-only access to your public profile — username, profile photo URL, and public media.</li>
      <li><strong>Image-derived identity data:</strong> Perceptual hash fingerprints and AI-generated feature vectors derived from your public profile photos. See Section 2 for the full written notice required by applicable biometric privacy laws.</li>
      <li><strong>Scan results:</strong> Records of monitoring activity, potential matches, and alerts stored in a managed PostgreSQL database.</li>
      <li><strong>Payment information:</strong> Subscriptions are managed by <strong>RevenueCat</strong> through Apple App Store or Google Play. We store only your subscription tier — we never see your payment card number or billing address.</li>
      <li><strong>Device and usage data:</strong> App interactions, device identifiers for push notifications, and feature usage to improve the service.</li>
      <li><strong>Consent records:</strong> Timestamps and version numbers of your acceptance of these Terms, Privacy Policy, and photo-processing consent. Retained as a legal compliance record.</li>
      <li><strong>Age confirmation:</strong> A timestamp recording that you declared you are 17 or older at signup. No date of birth is collected.</li>
    </ul>

    <h2>2. Biometric and Image-Derived Data — Written Notice</h2>

    <div class="notice-box">
      <h3>⚠ Required Written Notice (Illinois BIPA / Texas CUBI / GDPR Article 9)</h3>
      <p>This section constitutes the written notice required by the Illinois Biometric Information Privacy Act (740 ILCS 14), the Texas Capture or Use of Biometric Identifier Act (Tex. Bus. &amp; Com. Code § 503.001), and analogous state and international privacy laws before the collection of biometric or biometric-adjacent data.</p>
    </div>

    <h3>What We Collect</h3>
    <p>When you connect a social account or provide a reference photo, ${APP_NAME} derives the following from your public profile photos:</p>
    <ul>
      <li><strong>Perceptual hash fingerprints (dHash):</strong> A 64-bit numeric hash computed by resizing your photo to a 9×8 pixel grayscale thumbnail and recording pixel-level brightness differences. This is a compact digital signature of the image's visual structure — it is <em>not</em> raw image data, not a scan of facial geometry, and cannot reconstruct or identify a face or person on its own. It is used exclusively to detect whether visually similar images appear on other accounts.</li>
      <li><strong>AI-generated feature vectors (embeddings):</strong> Floating-point numerical arrays derived from AI analysis of your photos, used to identify visual similarity to potential impersonator accounts. These are produced by OpenAI's API and stored as encrypted numerical arrays — they cannot reconstruct the original image.</li>
      <li><strong>Visual fingerprint metadata:</strong> Aggregate counts and style descriptors summarizing your indexed media. No raw image content is stored by ${APP_NAME}.</li>
    </ul>

    <h3>Purpose of Collection</h3>
    <p><strong>Sole purpose:</strong> To detect whether your profile photos or visual identity appear on other social media accounts without your authorization — i.e., to identify potential impersonation or photo theft. This data is never used for advertising, sold to third parties, or used for any purpose other than identity monitoring for your account.</p>

    <h3>Length of Retention</h3>
    <ul>
      <li><strong>Perceptual hashes and embeddings:</strong> Retained while your account is active. Automatically destroyed upon account deletion or within 30 days thereafter (production backups purged on the same schedule).</li>
      <li><strong>If you withdraw photo-processing consent:</strong> All perceptual hashes, embeddings, and visual fingerprint data for your account are deleted within 24 hours of withdrawal. You can withdraw consent at any time in <strong>Profile → Settings → Privacy → Manage Photo Data</strong>. Withdrawing consent does not delete your account or your scan history.</li>
      <li><strong>Maximum retention period:</strong> Photo-derived data is not retained for more than 3 years from the date of collection, or 1 year after the purpose is fulfilled (whichever is sooner), consistent with Illinois BIPA Section 15(a) and Texas CUBI requirements.</li>
    </ul>

    <h3>Third-Party Services That Receive Photo Data</h3>
    <ul>
      <li><strong>Google Cloud Vision API:</strong> The URL of your public profile photo is sent to Google's Web Detection API to find where that image appears on the open web. Google does not receive your account credentials. Google's use of this data is governed by the <a href="https://policies.google.com/privacy" target="_blank">Google Privacy Policy</a> and Google Cloud Data Processing Addendum. Google does not retain submitted images for model training under the Cloud Vision API terms.</li>
      <li><strong>OpenAI API:</strong> Public photo content may be sent for AI-powered visual analysis to generate feature vectors. OpenAI's use is governed by the <a href="https://openai.com/policies/privacy-policy" target="_blank">OpenAI Privacy Policy</a>. ${APP_NAME} has API usage configured under OpenAI's zero data retention policy where available.</li>
      <li><strong>Serper / Google Custom Search API:</strong> Your name and username (text only — no images) are used as search queries to find publicly indexed accounts. No image data is transmitted.</li>
    </ul>

    <h3>Your Consent and Withdrawal Rights</h3>
    <p>By accepting these Terms and the separate in-app Photo Processing Consent prompt, you provide the written release required under Illinois BIPA Section 15(b) and Texas CUBI, and the explicit consent required under GDPR Article 9(2)(a), for ${APP_NAME} to collect, store, and use the image-derived data described above.</p>
    <p><strong>You may withdraw this consent at any time</strong> without penalty to your account by going to <strong>Profile → Settings → Privacy → Manage Photo Data → Withdraw Photo Processing Consent</strong>. Upon withdrawal, all photo-derived data is deleted and photo-based scanning is disabled for your account. Text-based and username-based identity monitoring will continue.</p>

    <h3>No Sale or Profit from Biometric Data</h3>
    <p>${APP_NAME} does not sell, lease, trade, or otherwise profit from your image-derived data. We do not disclose this data to any party other than the processors listed above, and only for the stated purpose of providing the identity monitoring service.</p>

    <h3>Security Standard</h3>
    <p>Image-derived data is stored with the same standard of care as other confidential information: encrypted at rest in PostgreSQL, encrypted in transit via TLS 1.2+, access-controlled to the authenticated user's account, and subject to our security review practices.</p>

    <h2>3. How We Use Your Information</h2>
    <ul>
      <li>To search social platforms for accounts that may be impersonating you or using your photos.</li>
      <li>To build and maintain your identity fingerprint for comparison against detected accounts.</li>
      <li>To send push notifications when potential matches are found (with your permission).</li>
      <li>To manage your subscription tier and feature access.</li>
      <li>To improve our detection algorithms using anonymized, aggregated data.</li>
      <li>To maintain legally required records of consent.</li>
    </ul>

    <h2>4. Platform OAuth Access</h2>
    <p>When you connect a social media account, ${APP_NAME} requests <strong>read-only</strong> OAuth permissions. We:</p>
    <ul>
      <li>Never post, comment, like, or take any action on your behalf.</li>
      <li>Never access your private messages or direct messages.</li>
      <li>Only read your public profile data and public media.</li>
      <li>Store OAuth access tokens encrypted at rest for ongoing monitoring.</li>
      <li>Use tokens solely to fetch your profile data for impersonation comparison.</li>
    </ul>
    <p>You can disconnect any account at any time from <strong>Profile → Connected Accounts</strong>. Disconnecting immediately deletes the stored OAuth token.</p>

    <h2>5. Data Sharing and Sub-Processors</h2>
    <p>We do not sell your personal information. We share data only with the following processors under contractual data protection obligations:</p>
    <ul>
      <li><strong>Clerk</strong> — Authentication and session management. Processes your email and device information. <a href="https://clerk.com/privacy" target="_blank">Privacy Policy</a>.</li>
      <li><strong>RevenueCat</strong> — Subscription entitlements. Payments processed by Apple/Google directly. <a href="https://www.revenuecat.com/privacy" target="_blank">Privacy Policy</a>.</li>
      <li><strong>Google Cloud Vision</strong> — Receives photo URLs for Web Detection. <a href="https://policies.google.com/privacy" target="_blank">Privacy Policy</a>.</li>
      <li><strong>OpenAI</strong> — Receives photo content for AI analysis and generates threat explanations. <a href="https://openai.com/policies/privacy-policy" target="_blank">Privacy Policy</a>.</li>
      <li><strong>Serper / Google Custom Search</strong> — Receives text search queries (your name, username). No image data.</li>
      <li><strong>Replit</strong> — Cloud infrastructure hosting our API server and database. <a href="https://replit.com/site/privacy" target="_blank">Privacy Policy</a>.</li>
      <li><strong>Law enforcement</strong> — Only when required by valid legal process (subpoena, court order) and we are legally permitted to notify you.</li>
    </ul>

    <h3>International Data Transfers</h3>
    <p>All processors listed above are based in the United States. If you are located in the EU, EEA, or UK, your data is transferred to the US under appropriate safeguards: <strong>Standard Contractual Clauses (SCCs)</strong> approved by the European Commission, incorporated by reference into our agreements with each processor. For questions about transfer mechanisms, contact <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a>.</p>

    <h2>6. Automated Decision-Making</h2>
    <p>${APP_NAME} uses AI to automatically generate threat scores and alerts. These are <strong>probabilistic estimates — not legal determinations</strong> — and may contain errors (false positives or false negatives). No automated decision produces a legal or similarly significant effect on you. You may dismiss any alert in the app, request human review by emailing <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>, and export your data to verify what we hold.</p>

    <h2>7. Data Retention and Deletion</h2>
    <ul>
      <li><strong>Account data:</strong> Retained while your account is active. Deleted from active systems immediately upon account deletion; purged from production backups within 30 days.</li>
      <li><strong>Threat history:</strong> Retained for 30 days (Premium), 7 days (Pro), 1 day (Free) from detection, then automatically deleted.</li>
      <li><strong>Image-derived data (perceptual hashes, embeddings):</strong> Retained while account is active; deleted immediately upon account deletion or consent withdrawal, with backup purge within 30 days. Never retained beyond 3 years from collection.</li>
      <li><strong>OAuth tokens:</strong> Deleted immediately upon account disconnection or deletion.</li>
      <li><strong>Consent records:</strong> Retained for 7 years after account deletion as a legal compliance record (Illinois BIPA Section 15(a) requires retention schedules to be maintained).</li>
      <li><strong>Anonymized usage analytics:</strong> May be retained up to 2 years in aggregated, non-identifiable form.</li>
    </ul>
    <p>Delete your account anytime under <strong>Profile → Delete Account</strong>. This deletes all your data from active systems immediately; backups are purged within 30 days.</p>

    <h2>8. Data Export (Portability)</h2>
    <p>You can download a machine-readable copy of all your personal data at any time from <strong>Profile → Settings → Privacy → Download My Data</strong>. The export includes your profile, connected accounts, scan history, threat records, and consent logs in JSON format, consistent with GDPR Article 20.</p>

    <h2>9. Security</h2>
    <p>All data is encrypted in transit (TLS 1.2+) and at rest. OAuth tokens are stored encrypted. Authentication is managed by Clerk with industry-standard session controls. We conduct regular security reviews and rate-limit all API endpoints to prevent abuse.</p>

    <h2>10. Minimum Age</h2>
    <p>${APP_NAME} requires users to be at least <strong>17 years old</strong>. By creating an account, you represent that you meet this requirement. We do not knowingly collect personal information from anyone under 17. If you believe a minor has registered, contact us immediately at <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a> and we will delete the account.</p>

    <h2>11. Your Rights — EU/EEA/UK Residents (GDPR)</h2>
    <p>If you are in the EU, EEA, or UK, you have the following rights under the GDPR (Art. 15–22):</p>
    <ul>
      <li><strong>Access (Art. 15):</strong> Request a copy of your personal data. Available immediately via in-app data export.</li>
      <li><strong>Rectification (Art. 16):</strong> Request correction of inaccurate data.</li>
      <li><strong>Erasure (Art. 17):</strong> Delete your account via <strong>Profile → Delete Account</strong>, or contact us.</li>
      <li><strong>Restrict Processing (Art. 18):</strong> Request that we limit processing while a dispute is resolved.</li>
      <li><strong>Data Portability (Art. 20):</strong> Download your data in structured JSON format via <strong>Profile → Settings → Privacy → Download My Data</strong>.</li>
      <li><strong>Object (Art. 21):</strong> Object to processing based on legitimate interests, including profiling.</li>
      <li><strong>Withdraw Consent (Art. 7(3)):</strong> Withdraw photo-processing consent at any time via <strong>Profile → Settings → Privacy → Manage Photo Data</strong>, without affecting the lawfulness of prior processing.</li>
      <li><strong>Human Review (Art. 22):</strong> Request human review of any automated decision that significantly affects you by emailing <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</li>
    </ul>
    <p><strong>Legal bases (Art. 6):</strong> <em>Contract performance</em> — providing the service you signed up for; <em>Legitimate interests</em> — security, fraud prevention; <em>Consent</em> — photo/image processing (Art. 9 explicit consent for biometric-adjacent data).</p>
    <p>To exercise any right, contact <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a>. We respond within <strong>one calendar month</strong> (extendable by two further months for complex requests, with notice). You also have the right to lodge a complaint with your local supervisory authority (e.g., the ICO in the UK, or your EU Member State DPA).</p>

    <h2>12. Your Rights — US State Residents</h2>

    <h3>Illinois — Biometric Information Privacy Act (BIPA)</h3>
    <p>Illinois residents have the right to: (1) know whether their biometric data is being collected; (2) request a copy of any written releases or consent records; (3) have their biometric data destroyed pursuant to the retention schedule above. To exercise these rights, contact <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a> with subject "BIPA Request."</p>

    <h3>Texas — Capture or Use of Biometric Identifier Act (CUBI)</h3>
    <p>Texas residents have the rights described under CUBI, including notice before capture, consent before use, prohibition on sale, and destruction when the purpose is no longer satisfied. Contact <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a> with subject "Texas CUBI Request."</p>

    <h3>California — CCPA/CPRA</h3>
    <ul>
      <li><strong>Right to Know:</strong> Disclosure of categories and specific pieces of personal information we collect.</li>
      <li><strong>Right to Delete:</strong> Via <strong>Profile → Delete Account</strong> or by emailing us.</li>
      <li><strong>Right to Opt-Out of Sale:</strong> We do not sell personal information.</li>
      <li><strong>Right to Correct:</strong> Request correction of inaccurate information.</li>
      <li><strong>Right to Limit Use of Sensitive Personal Information:</strong> Image-derived data may qualify as sensitive personal information under CPRA. Contact us to limit its use to service provision only.</li>
      <li><strong>Non-Discrimination:</strong> We will not discriminate for exercising CCPA/CPRA rights.</li>
    </ul>
    <p>To exercise CCPA rights, contact <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a> with subject "CCPA Request". We respond within 45 days.</p>

    <h3>Virginia, Colorado, Connecticut, and Other US State Privacy Laws</h3>
    <p>Residents of states with comprehensive privacy laws have similar access, deletion, correction, portability, and opt-out rights. Contact <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a> to exercise any state privacy right.</p>

    <h2>13. Changes to This Policy</h2>
    <p>We will notify you of material changes via email and in-app notification at least 14 days before they take effect. For changes that affect how we process biometric or image-derived data, we will obtain fresh explicit consent before continuing to process under the new terms. Continued use after the effective date constitutes acceptance of non-material changes.</p>

    <h2>14. Contact and Data Controller</h2>
    <div class="card">
      <p><strong>${BUSINESS_NAME}</strong> (Data Controller)</p>
      <p><strong>Address:</strong> ${BUSINESS_ADDRESS}</p>
      <p><strong>Phone:</strong> <a href="tel:${BUSINESS_PHONE.replace(/[^+\d]/g, "")}">${BUSINESS_PHONE}</a></p>
      <p><strong>Privacy &amp; biometric inquiries:</strong> <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a></p>
      <p><strong>General support:</strong> <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p><strong>Website:</strong> <a href="https://${DOMAIN}">https://${DOMAIN}</a></p>
    </div>
  `));
}

function serveTerms(_req: Request, res: Response) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html("Terms of Service", `
    <h1>Terms of Service</h1>
    <p class="meta">Last updated: ${LAST_UPDATED} &nbsp;·&nbsp; Version ${TERMS_VERSION}</p>

    <p>These Terms of Service ("Terms") govern your use of ${APP_NAME} ("Service"), operated by <strong>${BUSINESS_NAME}</strong>. By downloading, installing, or using the Service you agree to these Terms. If you do not agree, do not use the Service.</p>

    <p><strong>Independence.</strong> ${APP_NAME} is not affiliated with, endorsed by, or connected to Meta, Instagram, Facebook, Google, X (Twitter), TikTok, Snapchat, LinkedIn, Apple, or any other platform. All trademarks belong to their respective owners.</p>

    <h2>1. The Service</h2>
    <p>${APP_NAME} provides AI-powered identity monitoring services including detection of social media impersonators and potential photo theft. Scan results are probabilistic estimates — see Section 5. The Service is provided in Free, Pro, and Premium tiers.</p>

    <h2>2. Eligibility and Account Registration</h2>
    <p>You must be at least <strong>17 years old</strong> to use the Service. By creating an account, you represent that you are 17 or older. You must provide accurate information at registration. Account authentication is handled by <strong>Clerk</strong>. You are responsible for maintaining the security of your credentials and for all activity under your account.</p>

    <h2>3. Biometric and Image-Derived Data — Written Release</h2>

    <div class="notice-box">
      <h3>⚠ Biometric Data Written Release (Illinois BIPA § 15(b) / Texas CUBI / GDPR Art. 9)</h3>
      <p>This section constitutes the written release required by the Illinois Biometric Information Privacy Act and Texas Capture or Use of Biometric Identifier Act, and records your explicit consent required under GDPR Article 9(2)(a) for processing of biometric-adjacent data.</p>
    </div>

    <p>By accepting these Terms and the in-app Photo Processing Consent prompt, you:</p>
    <ul>
      <li>Acknowledge that you have received and read the written notice in the <a href="/privacy">Privacy Policy, Section 2</a>, describing what image-derived data is collected, for what specific purpose, and for what length of term;</li>
      <li>Grant ${APP_NAME} a <strong>limited, revocable, non-exclusive</strong> license to derive perceptual hash fingerprints and AI feature vectors from your public profile photos, and to send your photo URLs to Google Cloud Vision API and OpenAI API, solely for the purpose of detecting potential impersonation of your identity on social media;</li>
      <li>Understand that this license terminates upon withdrawal of your photo-processing consent (available at <strong>Profile → Settings → Privacy → Manage Photo Data</strong>) or upon account deletion, and that ${APP_NAME} will delete all image-derived data within 30 days of termination;</li>
      <li>Acknowledge that ${APP_NAME} does not sell, lease, trade, or otherwise profit from your image-derived data, and does not disclose it except to the processors described in the Privacy Policy for the stated purpose;</li>
      <li>Confirm you are the owner of, or are authorized to submit, the profile photos you provide.</li>
    </ul>
    <p><strong>You may withdraw this consent at any time</strong> without terminating your account or affecting your access to non-photo-based features of the Service.</p>

    <h2>4. Connected Social Accounts</h2>
    <p>By connecting a social media account you authorize ${APP_NAME} to access your public profile in read-only mode for identity monitoring. You represent that you own or have authorization to connect each account. ${APP_NAME} will never post, message, or take any action on your behalf. You may disconnect at any time via <strong>Profile → Connected Accounts</strong>.</p>

    <h2>5. AI-Generated Results — Accuracy Disclaimer</h2>
    <p>The Service uses AI and machine learning to identify <em>potential</em> identity threats. <strong>All alerts, threat scores, and analyses are probabilistic estimates. They may contain errors, false positives, and false negatives.</strong> Results are not legal determinations, and ${APP_NAME} makes no guarantee that all threats will be detected or that any detected match is an actual impersonator. You must independently verify any alert before taking action. ${APP_NAME} is not liable for actions taken or not taken based on Service results.</p>

    <h2>6. Subscriptions and Payments</h2>
    <ul>
      <li><strong>Free:</strong> 1 connected account, manual scans, 1-day threat history.</li>
      <li><strong>Pro — $4.99/month</strong> (or $39.99/year): Up to 3 connected accounts, weekly scheduled scans, 7-day threat history, push alerts.</li>
      <li><strong>Premium — $9.99/month</strong> (or $79.99/year): Up to 10 connected accounts, daily scans, advanced AI analysis, 30-day threat history, priority support.</li>
    </ul>
    <p>All paid plans include a <strong>7-day free trial</strong> for new subscribers — no charge during the trial. Subscriptions are billed in advance and <strong>auto-renew</strong> unless cancelled at least 24 hours before the end of the billing period. After the trial, you will be charged the applicable price unless you cancel before the trial ends. Subscription management is through iOS Settings or Google Play Subscriptions. No partial refunds for unused time. Price changes will be communicated with at least 30 days' notice.</p>

    <h2>7. Acceptable Use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>Use the Service to monitor accounts you do not own or are not authorized to monitor.</li>
      <li>Reverse engineer, scrape, or extract data from the Service or APIs.</li>
      <li>Use the Service for any unlawful purpose or to harass, threaten, or intimidate others.</li>
      <li>Circumvent rate limits, subscription tiers, or access controls.</li>
      <li>Submit someone else's photos as your own to generate false reports about them.</li>
    </ul>
    <p>Violations may result in immediate account termination without refund.</p>

    <h2>8. Intellectual Property</h2>
    <p>${APP_NAME} owns all right, title, and interest in the Service, including software, algorithms, designs, and trademarks. You retain ownership of your own photos and content. The biometric data license granted in Section 3 is limited to providing the Service and terminates upon consent withdrawal or account deletion.</p>

    <h2>9. Disclaimer of Warranties</h2>
    <p>The Service is provided "as is." We do not warrant complete detection of all impersonators or threats. Coverage depends on platform API availability and our detection algorithms, which are improving but not infallible.</p>

    <h2>10. Limitation of Liability</h2>
    <p>To the maximum extent permitted by law, ${APP_NAME} shall not be liable for any indirect, incidental, special, or consequential damages. Our total liability for any claim shall not exceed the amount you paid us in the 12 months preceding the claim. Nothing in this section limits liability for gross negligence, willful misconduct, or where prohibited by applicable law (including BIPA statutory damages).</p>

    <h2>11. Termination and Account Deletion</h2>
    <p>We may suspend or terminate your account for violation of these Terms. You may delete your account at any time via <strong>Profile → Delete Account</strong>, which immediately removes your data from active systems; production backups are purged within 30 days. Consent records are retained for 7 years as legally required. Upon termination, the biometric data license in Section 3 terminates and all image-derived data is deleted pursuant to the retention schedule in the Privacy Policy.</p>

    <h2>12. Dispute Resolution and Governing Law</h2>
    <p>These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles. Disputes shall first be submitted to informal resolution by emailing <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>. If not resolved in 30 days, disputes shall be resolved by binding individual arbitration under AAA rules, conducted in English. <strong>You waive the right to participate in class actions or class-wide arbitration.</strong> Either party may seek injunctive or equitable relief in a court of competent jurisdiction.</p>
    <p>EU/EEA users may also contact the European Online Dispute Resolution platform at <a href="https://ec.europa.eu/consumers/odr" target="_blank">ec.europa.eu/consumers/odr</a>.</p>
    <p><strong>Note for Illinois residents:</strong> Nothing in this arbitration clause is intended to waive any rights under the Illinois Biometric Information Privacy Act that are not waivable by contract.</p>

    <h2>13. Changes to Terms</h2>
    <p>We may update these Terms at any time. Material changes will be communicated via email or in-app notification at least 14 days before taking effect. Changes affecting how we process biometric or image-derived data require fresh explicit consent before they take effect. Continued use after the effective date constitutes acceptance of non-material changes.</p>

    <h2>14. Contact</h2>
    <div class="card">
      <p><strong>${BUSINESS_NAME}</strong></p>
      <p><strong>Address:</strong> ${BUSINESS_ADDRESS}</p>
      <p><strong>Phone:</strong> <a href="tel:${BUSINESS_PHONE.replace(/[^+\d]/g, "")}">${BUSINESS_PHONE}</a></p>
      <p><strong>Privacy &amp; biometric inquiries:</strong> <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a></p>
      <p><strong>Support:</strong> <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p><strong>Website:</strong> <a href="https://${DOMAIN}">https://${DOMAIN}</a></p>
    </div>
  `));
}

function serveSupport(_req: Request, res: Response) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html("Support", `
    <h1>Support</h1>
    <p class="meta">We're here to help with ${APP_NAME}.</p>

    <div class="card">
      <h2 style="margin-top:0">Contact Us</h2>
      <p><strong>General support:</strong> <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p><strong>Privacy &amp; biometric data requests:</strong> <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a></p>
      <p>We aim to respond within 1 business day (privacy requests within 30 days).</p>
    </div>

    <h2>Common Questions</h2>

    <h2>How does Rook find potential impersonators?</h2>
    <p>${APP_NAME} uses AI to search social platforms and public photo indexes for accounts that visually or textually resemble yours. When a potential match is found, you receive a push notification with the evidence for your review. All results require your verification — Rook does not confirm that any detected account is an actual impersonator.</p>

    <h2>What photo data does Rook store?</h2>
    <p>Rook stores a compact perceptual hash (64-bit numeric fingerprint) and AI feature vector derived from your profile photos. These are <em>not</em> raw images — they cannot reconstruct your photos. Full details are in the <a href="/privacy">Privacy Policy, Section 2</a>. You can delete this data without deleting your account via <strong>Profile → Settings → Privacy → Manage Photo Data</strong>.</p>

    <h2>Which platforms are searched?</h2>
    <p>Rook searches public web indexes including Instagram, Facebook, X (Twitter), TikTok, and more using public search APIs. Rook is not affiliated with any of these platforms.</p>

    <h2>How often are scans performed?</h2>
    <p>Free accounts get one manual scan per month. Pro accounts scan weekly on a schedule. Premium accounts scan daily. You can also trigger a manual scan anytime from the Scan tab.</p>

    <h2>How do I cancel my subscription?</h2>
    <ul>
      <li><strong>iOS:</strong> Settings → [your name] → Subscriptions → Rook → Cancel</li>
      <li><strong>Android:</strong> Google Play → Menu → Subscriptions → Rook → Cancel</li>
    </ul>
    <p>Access continues until the end of the current billing period.</p>

    <h2>How do I delete my account?</h2>
    <p>Go to <strong>Profile → Delete Account</strong>. This immediately removes your account and all associated data from active systems. Backups are purged within 30 days. You can also email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> with "Delete My Account" in the subject line.</p>

    <h2>How do I download my data?</h2>
    <p>Go to <strong>Profile → Settings → Privacy → Download My Data</strong>. You'll receive a JSON file with your profile, scan history, threat records, and consent logs.</p>

    <h2>How do I withdraw consent for photo processing?</h2>
    <p>Go to <strong>Profile → Settings → Privacy → Manage Photo Data → Withdraw Photo Processing Consent</strong>. This deletes all your perceptual hash data within 24 hours. Text-based identity monitoring will continue. Your account and scan history are preserved.</p>

    <div class="card">
      <p><a href="/privacy">Privacy Policy</a> &nbsp;·&nbsp; <a href="/terms">Terms of Service</a></p>
    </div>
  `));
}

router.get("/legal/privacy", servePrivacy);
router.get("/legal/terms", serveTerms);
router.get("/legal/support", serveSupport);

publicLegalRouter.get("/privacy", servePrivacy);
publicLegalRouter.get("/terms", serveTerms);
publicLegalRouter.get("/support", serveSupport);

export { DOMAIN, publicLegalRouter };
export default router;
