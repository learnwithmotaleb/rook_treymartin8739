import { Router, type IRouter } from "express";

const router: IRouter = Router();

const DOMAIN = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim()
  ?? process.env["REPLIT_DEV_DOMAIN"]
  ?? "shieldid.app";

const APP_NAME = "ShieldID";
const CONTACT_EMAIL = "privacy@shieldid.app";
const SUPPORT_EMAIL = "support@shieldid.app";
const LAST_UPDATED = "June 5, 2026";

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
    .logo-mark { width: 36px; height: 36px; background: #3B82F6; border-radius: 10px;
                 display: flex; align-items: center; justify-content: center; font-size: 20px; }
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
      <div class="logo-mark">🛡</div>
      <span class="logo-name">${APP_NAME}</span>
    </div>
    ${body}
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME} &nbsp;·&nbsp;
      <a href="/api/legal/privacy">Privacy Policy</a> &nbsp;·&nbsp;
      <a href="/api/legal/terms">Terms of Service</a> &nbsp;·&nbsp;
      <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
    </div>
  </div>
</body>
</html>`;

router.get("/legal/privacy", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html("Privacy Policy", `
    <h1>Privacy Policy</h1>
    <p class="meta">Last updated: ${LAST_UPDATED}</p>

    <p>${APP_NAME} ("we", "our", "us") is an AI-powered identity protection service that monitors social platforms for impersonators and stolen photos. This Privacy Policy explains how we collect, use, and protect your information.</p>

    <h2>1. Information We Collect</h2>
    <p>We collect information you provide directly and information we obtain through connected social accounts:</p>
    <ul>
      <li><strong>Account information:</strong> Name, email address, and username when you register.</li>
      <li><strong>Connected platform data:</strong> When you authorize ${APP_NAME} to access a social platform, we receive read-only access to your public profile information including your username, profile photo, follower count, and public posts.</li>
      <li><strong>Visual fingerprint data:</strong> Perceptual hashes (not raw images) derived from your public photos, used to detect visually similar stolen content.</li>
      <li><strong>Scan results:</strong> Records of monitoring activity, detected threats, and impersonation alerts associated with your account.</li>
      <li><strong>Payment information:</strong> Subscriptions and billing are handled by <strong>RevenueCat</strong> and processed through the Apple App Store or Google Play Store. We store only your subscription tier and entitlement status — we never see or store your full payment card number or billing details.</li>
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

    <h2>4. Data Sharing</h2>
    <p>We do not sell your personal information. We share data only with:</p>
    <ul>
      <li><strong>RevenueCat:</strong> For subscription management and entitlement verification (subject to <a href="https://www.revenuecat.com/privacy" target="_blank">RevenueCat's Privacy Policy</a>). Payments are processed directly by Apple or Google — we never handle payment card data.</li>
      <li><strong>Google Cloud Vision:</strong> Photo URLs from your connected accounts are sent to Google's Web Detection API to find where those images appear on the open web (subject to <a href="https://policies.google.com/privacy" target="_blank">Google's Privacy Policy</a>).</li>
      <li><strong>OpenAI:</strong> Anonymized text snippets may be analyzed to generate AI threat explanations (subject to <a href="https://openai.com/policies/privacy-policy" target="_blank">OpenAI's Privacy Policy</a>).</li>
      <li><strong>Infrastructure providers:</strong> Cloud hosting and database services necessary to operate the app.</li>
      <li><strong>Law enforcement:</strong> Only when required by applicable law.</li>
    </ul>

    <h2>5. Data Retention</h2>
    <p>We retain your data for as long as your account is active. You may delete your account and all associated data at any time by contacting <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. Deleted data is purged from our systems within 30 days.</p>

    <h2>6. Security</h2>
    <p>All data is encrypted in transit (TLS 1.2+) and at rest. OAuth tokens are stored encrypted. We follow industry-standard security practices and conduct regular security reviews.</p>

    <h2>7. Children's Privacy</h2>
    <p>${APP_NAME} is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us personal information, contact us immediately at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

    <h2>8. Your Rights</h2>
    <p>Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data. California residents may have additional rights under CCPA. Contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> to exercise these rights.</p>

    <h2>9. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or in-app notification. Continued use of the service after changes constitutes acceptance.</p>

    <h2>10. Contact</h2>
    <div class="card">
      <p><strong>Privacy inquiries:</strong> <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
      <p><strong>Support:</strong> <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p><strong>Website:</strong> <a href="https://${DOMAIN}">https://${DOMAIN}</a></p>
    </div>
  `));
});

router.get("/legal/terms", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html("Terms of Service", `
    <h1>Terms of Service</h1>
    <p class="meta">Last updated: ${LAST_UPDATED}</p>

    <p>These Terms of Service ("Terms") govern your use of ${APP_NAME} ("Service"). By using the Service you agree to these Terms.</p>

    <h2>1. The Service</h2>
    <p>${APP_NAME} provides AI-powered identity monitoring services including detection of social media impersonators and stolen photos. The Service is provided on a subscription basis with Free, Pro, and Premium tiers.</p>

    <h2>2. Account Registration</h2>
    <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 13 years old to use the Service.</p>

    <h2>3. Connected Social Accounts</h2>
    <p>By connecting a social media account you authorize ${APP_NAME} to access your public profile information in read-only mode for identity monitoring purposes. You represent that you own or have authorization to connect each account. You may disconnect accounts at any time.</p>

    <h2>4. Subscriptions and Payments</h2>
    <ul>
      <li><strong>Free tier:</strong> Limited monitoring for 1 account, manual scans every 14 days.</li>
      <li><strong>Pro tier ($7.99/month or $59.99/year):</strong> Up to 3 accounts, weekly automated scans, real-time alerts with full evidence trails.</li>
      <li><strong>Premium tier ($14.99/month or $99.99/year):</strong> Unlimited accounts, daily deep scans, advanced intelligence reports.</li>
    </ul>
    <p>Paid subscriptions are billed in advance on a recurring basis through the Apple App Store or Google Play Store. All paid subscriptions include a 7-day free trial for new subscribers. You may cancel at any time through your device's subscription settings; cancellation takes effect at the end of the current billing period. No partial refunds are issued for unused periods. Subscription management is handled by Apple or Google according to their respective terms.</p>

    <h2>5. Acceptable Use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>Use the Service to monitor accounts you do not own or have authorization to monitor.</li>
      <li>Attempt to reverse engineer, scrape, or extract data from the Service.</li>
      <li>Use the Service for any unlawful purpose or to harass others.</li>
      <li>Circumvent any rate limits, subscription tiers, or access controls.</li>
    </ul>

    <h2>6. Disclaimer of Warranties</h2>
    <p>The Service is provided "as is" without warranty of any kind. We do not guarantee that all impersonators or threats will be detected. Monitoring coverage depends on platform API availability and our detection algorithms, which are continuously improving but not infallible.</p>

    <h2>7. Limitation of Liability</h2>
    <p>To the maximum extent permitted by law, ${APP_NAME} shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.</p>

    <h2>8. Termination</h2>
    <p>We may suspend or terminate your account for violation of these Terms. You may delete your account at any time from the app settings or by contacting support.</p>

    <h2>9. Changes to Terms</h2>
    <p>We may update these Terms at any time. Material changes will be communicated via email or in-app notification. Continued use of the Service constitutes acceptance of updated Terms.</p>

    <h2>10. Contact</h2>
    <div class="card">
      <p><strong>Support:</strong> <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p><strong>Privacy:</strong> <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
      <p><strong>Website:</strong> <a href="https://${DOMAIN}">https://${DOMAIN}</a></p>
    </div>
  `));
});

router.get("/legal/support", (_req, res) => {
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
      <li><strong>iOS:</strong> Settings → [your name] → Subscriptions → ShieldID → Cancel</li>
      <li><strong>Android:</strong> Google Play → Menu → Subscriptions → ShieldID → Cancel</li>
    </ul>
    <p>Your access continues until the end of the current billing period.</p>

    <h2>How do I delete my account?</h2>
    <p>Email us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> with the subject "Delete My Account". We'll process the request within 30 days and confirm by email.</p>

    <h2>My scan didn't find any threats — is that right?</h2>
    <p>That's great news — it likely means no impersonators have been detected. ${APP_NAME} cross-references your public content against the open web. If you recently connected a new account, wait for the identity fingerprint to build before running a scan.</p>

    <div class="card">
      <p><a href="/api/legal/privacy">Privacy Policy</a> &nbsp;·&nbsp; <a href="/api/legal/terms">Terms of Service</a></p>
    </div>
  `));
});

export { DOMAIN };
export default router;
