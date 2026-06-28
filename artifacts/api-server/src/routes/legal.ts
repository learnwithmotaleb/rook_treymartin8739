import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const publicLegalRouter: IRouter = Router();

const DOMAIN = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim()
  ?? process.env["REPLIT_DEV_DOMAIN"]
  ?? "tryrook.app";

const APP_NAME = "Rook";
const CONTACT_EMAIL = "privacy@tryrook.app";
const SUPPORT_EMAIL = "support@tryrook.app";
const LAST_UPDATED = "June 15, 2026";

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
    p { color: #94a3b8; margin-bottom: 14px; }
    ul { color: #94a3b8; margin: 0 0 14px 20px; }
    li { margin-bottom: 6px; }
    a { color: #3B82F6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .card { background: #131929; border: 1px solid #1e2d4a; border-radius: 14px;
            padding: 24px; margin: 24px 0; }
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
      <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
    </div>
  </div>
</body>
</html>`;

function servePrivacy(_req: Request, res: Response) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html("Privacy Policy", `
    <h1>Privacy Policy</h1>
    <p class="meta">Last updated: ${LAST_UPDATED}</p>

    <p>${APP_NAME} ("we", "our", "us") is an AI-powered identity protection service that monitors social platforms for impersonators and stolen photos. This Privacy Policy explains how we collect, use, and protect your information.</p>

    <h2>1. Information We Collect</h2>
    <p>We collect information you provide directly and information we obtain through connected social accounts:</p>
    <ul>
      <li><strong>Account information:</strong> Name, email address, and username when you register. Authentication is handled by <strong>Clerk</strong> — we receive a secure user identifier (Clerk user ID) and basic profile info, but never your password.</li>
      <li><strong>Connected platform data:</strong> When you authorize ${APP_NAME} to access a social platform, we receive read-only access to your public profile information — username, profile photo, follower count, and public posts.</li>
      <li><strong>Identity fingerprint data:</strong> Perceptual hashes (not raw images) derived from your public photos, used to detect visually similar stolen content.</li>
      <li><strong>Scan results:</strong> Records of monitoring activity, detected threats, and impersonation alerts associated with your account. Stored in a managed <strong>PostgreSQL</strong> database.</li>
      <li><strong>Payment information:</strong> Subscriptions are managed by <strong>RevenueCat</strong> and billed through the Apple App Store or Google Play Store. We store only your subscription tier and entitlement status — we never see your full payment card number or billing address.</li>
      <li><strong>Usage data:</strong> App interactions, feature usage, and device information to improve the service.</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To scan connected social platforms for impersonators and identity threats.</li>
      <li>To build and maintain your identity fingerprint for comparison against detected accounts.</li>
      <li>To send you alerts when threats are detected (push notifications, per your preferences).</li>
      <li>To manage your subscription tier and feature access.</li>
      <li>To improve our detection algorithms and service quality.</li>
    </ul>

    <h2>3. Platform OAuth Access</h2>
    <p>When you connect a social media account (e.g. Instagram, X, TikTok), ${APP_NAME} requests <strong>read-only</strong> OAuth permissions. We:</p>
    <ul>
      <li>Never post, comment, like, or take any action on your behalf.</li>
      <li>Never access your private messages or direct messages.</li>
      <li>Only read your public profile data and public media.</li>
      <li>Store OAuth access tokens encrypted at rest to enable ongoing monitoring.</li>
      <li>Use tokens solely to fetch your profile data for impersonation comparison.</li>
    </ul>
    <p>You can revoke access at any time from the platform's settings page or by disconnecting the account in ${APP_NAME}.</p>

    <h2>4. Data Processors</h2>
    <p>We use the following sub-processors to deliver the service:</p>
    <ul>
      <li><strong>Clerk</strong> — authentication and identity management (<a href="https://clerk.com/privacy" target="_blank">Privacy Policy</a>)</li>
      <li><strong>PostgreSQL on Replit</strong> — encrypted-at-rest managed database hosting all user and threat data</li>
      <li><strong>RevenueCat</strong> — subscription management and entitlement verification (<a href="https://www.revenuecat.com/privacy" target="_blank">Privacy Policy</a>)</li>
      <li><strong>Google Cloud Vision</strong> — photo URLs are sent to Google's Web Detection API to locate stolen images on the open web (<a href="https://policies.google.com/privacy" target="_blank">Privacy Policy</a>)</li>
      <li><strong>OpenAI</strong> — anonymized text snippets may be sent for AI-generated threat explanations (<a href="https://openai.com/policies/privacy-policy" target="_blank">Privacy Policy</a>)</li>
      <li><strong>Replit</strong> — cloud infrastructure and hosting (<a href="https://replit.com/privacy" target="_blank">Privacy Policy</a>)</li>
    </ul>
    <p>We do not sell your personal information to any third party.</p>

    <h2>5. Automated Decision-Making</h2>
    <p>${APP_NAME} uses AI algorithms to automatically analyze social media content and generate threat scores and alerts. These scores are probabilistic estimates — not legal determinations — and may contain errors. You have the right to request human review of any automated alert by contacting <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. All AI-generated results are labeled as such within the app.</p>

    <h2>6. Data Retention</h2>
    <ul>
      <li><strong>Account data:</strong> Retained until account deletion; purged within 30 days thereafter.</li>
      <li><strong>Threat history:</strong> Retained for 30 days (Premium), 7 days (Pro), 1 day (Free) from detection, then automatically deleted.</li>
      <li><strong>Identity fingerprint data (perceptual hashes):</strong> Retained while account is active; deleted upon account deletion.</li>
      <li><strong>OAuth tokens:</strong> Deleted immediately upon account disconnection or account deletion.</li>
      <li><strong>Anonymized usage analytics:</strong> May be retained for up to 2 years in aggregated, non-identifiable form.</li>
    </ul>
    <p>You may delete your account and all associated data at any time directly in the app under <strong>Profile → Delete Account</strong>. Data is purged from our production systems within 30 days of deletion.</p>

    <h2>7. Security</h2>
    <p>All data is encrypted in transit (TLS 1.2+) and at rest in PostgreSQL. OAuth tokens are stored encrypted. We follow industry-standard security practices and conduct regular security reviews.</p>

    <h2>8. Children's Privacy</h2>
    <p>${APP_NAME} is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us personal information, contact us immediately at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

    <h2>9. Your Rights (GDPR — EU/EEA/UK Residents)</h2>
    <p>If you are located in the EU, EEA, or UK, you have the following rights under the GDPR (Art. 15–22):</p>
    <ul>
      <li><strong>Right of Access (Art. 15):</strong> Request a copy of the personal data we hold about you.</li>
      <li><strong>Right to Rectification (Art. 16):</strong> Request correction of inaccurate or incomplete data.</li>
      <li><strong>Right to Erasure / "Right to be Forgotten" (Art. 17):</strong> Request deletion via <strong>Profile → Delete Account</strong> or by contacting us.</li>
      <li><strong>Right to Restrict Processing (Art. 18):</strong> Request that we limit how we use your data.</li>
      <li><strong>Right to Data Portability (Art. 20):</strong> Request your personal data in a structured, machine-readable format.</li>
      <li><strong>Right to Object (Art. 21):</strong> Object to processing based on legitimate interests, including profiling.</li>
      <li><strong>Right to Human Review (Art. 22):</strong> Request human review of any automated decision that significantly affects you.</li>
    </ul>
    <p>Our legal bases for processing (Art. 6): <em>contract performance</em> (providing the service you signed up for), <em>legitimate interests</em> (fraud prevention, security), and <em>consent</em> (marketing communications). To exercise any right, contact <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. We respond within 30 days. You also have the right to lodge a complaint with your local supervisory authority.</p>

    <h2>10. Your Rights (CCPA — California Residents)</h2>
    <ul>
      <li><strong>Right to Know:</strong> Request disclosure of the categories and specific pieces of personal information we collect, use, or disclose.</li>
      <li><strong>Right to Delete:</strong> Request deletion via <strong>Profile → Delete Account</strong> or contact us.</li>
      <li><strong>Right to Opt-Out of Sale:</strong> We do not sell personal information.</li>
      <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising CCPA rights.</li>
      <li><strong>Right to Correct:</strong> Request correction of inaccurate personal information.</li>
    </ul>
    <p>To exercise CCPA rights, contact <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with subject "CCPA Request". We respond within 45 days.</p>

    <h2>11. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or in-app notification. Continued use of the service after changes constitutes acceptance.</p>

    <h2>12. Contact</h2>
    <div class="card">
      <p><strong>Privacy inquiries:</strong> <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
      <p><strong>Support:</strong> <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p><strong>Website:</strong> <a href="https://${DOMAIN}">https://${DOMAIN}</a></p>
    </div>
  `));
}

function serveTerms(_req: Request, res: Response) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html("Terms of Service", `
    <h1>Terms of Service</h1>
    <p class="meta">Last updated: ${LAST_UPDATED}</p>

    <p>These Terms of Service ("Terms") govern your use of ${APP_NAME} ("Service"). By downloading, installing, or using the Service you agree to these Terms. If you do not agree, do not use the Service.</p>

    <h2>1. The Service</h2>
    <p>${APP_NAME} provides AI-powered identity monitoring services including detection of social media impersonators and stolen photos. The Service is provided on a subscription basis with Free, Pro, and Premium tiers as described below.</p>

    <h2>2. Account Registration</h2>
    <p>You must provide accurate information when creating an account. Account creation and authentication is handled by <strong>Clerk</strong>. You are responsible for maintaining the security of your account credentials. You must be at least 13 years old to use the Service.</p>

    <h2>3. Connected Social Accounts</h2>
    <p>By connecting a social media account you authorize ${APP_NAME} to access your public profile information in read-only mode for identity monitoring purposes. You represent that you own or have authorization to connect each account. You may disconnect accounts at any time.</p>

    <h2>4. Subscriptions and Payments</h2>
    <ul>
      <li><strong>Free tier:</strong> 1 connected account, manual scans only, 24-hour threat history.</li>
      <li><strong>Pro — $4.99/month:</strong> Up to 3 connected accounts, weekly automated scans, 7-day threat history, real-time alerts with full evidence trails.</li>
      <li><strong>Premium — $9.99/month:</strong> Unlimited connected accounts, daily deep scans, 30-day threat history, advanced intelligence reports, priority support.</li>
    </ul>
    <p>Paid subscriptions are billed in advance on a monthly recurring basis through the Apple App Store or Google Play Store. All paid subscriptions include a <strong>7-day free trial</strong> for new subscribers — you will not be charged during the trial period. After the trial, you will be charged the applicable subscription price ($4.99/month for Pro, $9.99/month for Premium) unless you cancel at least 24 hours before the trial ends.</p>
    <p>You may cancel at any time through your device's subscription settings (iOS: Settings → [your name] → Subscriptions → Rook → Cancel; Android: Google Play → Subscriptions → Rook → Cancel). Cancellation takes effect at the end of the current billing period. No partial refunds are issued for unused periods. Subscription management and billing are handled by Apple or Google according to their respective terms.</p>

    <h2>5. AI-Generated Content and Accuracy Disclaimer</h2>
    <p>The Service uses artificial intelligence and machine learning to identify potential identity threats. <strong>All AI-generated alerts, threat scores, and analyses are probabilistic estimates — they may contain errors, false positives, or false negatives.</strong> Results do not constitute legal advice, and ${APP_NAME} makes no guarantee that all threats will be detected or that detected threats are accurate. You should independently verify any alert before taking action. ${APP_NAME} is not liable for any action taken (or not taken) based on AI-generated results.</p>

    <h2>6. Acceptable Use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>Use the Service to monitor accounts you do not own or have authorization to monitor.</li>
      <li>Attempt to reverse engineer, scrape, or extract data from the Service.</li>
      <li>Use the Service for any unlawful purpose or to harass others.</li>
      <li>Circumvent any rate limits, subscription tiers, or access controls.</li>
    </ul>

    <h2>7. Intellectual Property</h2>
    <p>${APP_NAME} and its licensors own all right, title, and interest in the Service, including all software, algorithms, designs, trademarks, and content we create. You retain ownership of your own content. You grant ${APP_NAME} a limited, non-exclusive, royalty-free license to process your content solely to provide the identity monitoring service described in these Terms.</p>

    <h2>8. Disclaimer of Warranties</h2>
    <p>The Service is provided "as is" without warranty of any kind. We do not guarantee that all impersonators or threats will be detected. Monitoring coverage depends on platform API availability and our detection algorithms, which are continuously improving but not infallible.</p>

    <h2>9. Limitation of Liability</h2>
    <p>To the maximum extent permitted by law, ${APP_NAME} shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability for any claim arising out of or relating to these Terms shall not exceed the amount you paid us in the 12 months preceding the claim.</p>

    <h2>10. Dispute Resolution and Governing Law</h2>
    <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any dispute shall first be submitted to informal resolution by contacting <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>. If not resolved within 30 days, disputes shall be resolved by binding individual arbitration under the rules of the American Arbitration Association (AAA), conducted in English. <strong>You waive any right to participate in class actions or class-wide arbitration.</strong> Nothing in this section prevents either party from seeking injunctive or other equitable relief in a court of competent jurisdiction.</p>
    <p>Users in the EU/EEA may also submit disputes to the European Online Dispute Resolution platform at <a href="https://ec.europa.eu/consumers/odr" target="_blank">ec.europa.eu/consumers/odr</a>.</p>

    <h2>11. Termination</h2>
    <p>We may suspend or terminate your account for violation of these Terms. You may delete your account at any time directly in the app under <strong>Profile → Delete Account</strong>, which immediately and permanently deletes all your data. Upon termination, all licenses granted under these Terms cease.</p>

    <h2>12. Changes to Terms</h2>
    <p>We may update these Terms at any time. Material changes will be communicated via email or in-app notification at least 14 days before taking effect. Continued use of the Service after the effective date constitutes acceptance of updated Terms.</p>

    <h2>13. Contact</h2>
    <div class="card">
      <p><strong>Support:</strong> <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p><strong>Privacy:</strong> <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
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
      <p><strong>Email:</strong> <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p>We aim to respond within 1 business day.</p>
    </div>

    <h2>Common Questions</h2>

    <h2>How do I connect a social account?</h2>
    <p>Go to the <strong>Profile</strong> tab → <strong>Connected Accounts</strong> → tap <strong>Add Account</strong>. Select the platform and follow the OAuth authorization flow. You'll be returned to ${APP_NAME} automatically.</p>

    <h2>How do I run a scan?</h2>
    <p>Open the <strong>Scan</strong> tab and tap the scan button. Your first scan may take a few minutes as ${APP_NAME} builds your identity fingerprint. Subsequent scans are faster.</p>

    <h2>How do I cancel my subscription?</h2>
    <p>Subscriptions are managed through the App Store (iOS) or Google Play (Android). To cancel:</p>
    <ul>
      <li><strong>iOS:</strong> Settings → [your name] → Subscriptions → Rook → Cancel</li>
      <li><strong>Android:</strong> Google Play → Menu → Subscriptions → Rook → Cancel</li>
    </ul>
    <p>Your access continues until the end of the current billing period.</p>

    <h2>How do I delete my account?</h2>
    <p>Go to <strong>Profile → Delete Account</strong> in the app. This immediately and permanently deletes your account, all connected social accounts, identity fingerprint, threat history, and any active subscription. Data is purged from our systems within 30 days. You can also email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> with "Delete My Account" as the subject for assistance.</p>

    <h2>My scan didn't find any threats — is that right?</h2>
    <p>That's great news — it likely means no impersonators have been detected. ${APP_NAME} cross-references your public content against the open web. If you recently connected a new account, wait for the identity fingerprint to build before running a scan.</p>

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
