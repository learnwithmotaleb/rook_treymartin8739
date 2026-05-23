import { Router, type IRouter } from "express";

const router: IRouter = Router();

const DOMAIN = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim()
  ?? process.env["REPLIT_DEV_DOMAIN"]
  ?? "shieldid.app";

const APP_NAME = "ShieldID";
const CONTACT_EMAIL = "privacy@shieldid.app";
const LAST_UPDATED = "May 20, 2025";

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

    <p>${APP_NAME} ("we", "our", "us") is an AI-powered identity protection service that monitors social platforms for impersonators, stolen photos, and data breaches. This Privacy Policy explains how we collect, use, and protect your information.</p>

    <h2>1. Information We Collect</h2>
    <p>We collect information you provide directly and information we obtain through connected social accounts:</p>
    <ul>
      <li><strong>Account information:</strong> Name, email address, and username when you register.</li>
      <li><strong>Connected platform data:</strong> When you authorize ${APP_NAME} to access a social platform, we receive read-only access to your public profile information including your username, profile photo, follower count, and public posts.</li>
      <li><strong>Scan results:</strong> Records of monitoring activity, detected threats, and impersonation alerts associated with your account.</li>
      <li><strong>Payment information:</strong> Billing is handled by Stripe. We store only your subscription tier and Stripe customer ID — we never see or store your full card number.</li>
      <li><strong>Usage data:</strong> App interactions, feature usage, and device information to improve the service.</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To scan connected social platforms for impersonators and identity threats.</li>
      <li>To build and maintain your identity fingerprint for comparison against detected accounts.</li>
      <li>To send you alerts when threats are detected (push notifications and email, per your preferences).</li>
      <li>To process subscription payments and manage your account.</li>
      <li>To improve our detection algorithms and service quality.</li>
    </ul>

    <h2>3. Platform OAuth Access</h2>
    <p>When you connect a social media account (e.g. Instagram, X, TikTok), ${APP_NAME} requests <strong>read-only</strong> OAuth permissions. We:</p>
    <ul>
      <li>Never post, comment, like, or take any action on your behalf.</li>
      <li>Never access your private messages or direct messages.</li>
      <li>Only read your public profile data and public media.</li>
      <li>Store OAuth access tokens encrypted at rest to enable ongoing monitoring.</li>
      <li>Tokens are used solely to fetch your profile data for impersonation comparison.</li>
    </ul>
    <p>You can revoke access at any time from the platform's settings page or by disconnecting the account in ${APP_NAME}.</p>

    <h2>4. Data Sharing</h2>
    <p>We do not sell your personal information. We share data only with:</p>
    <ul>
      <li><strong>Stripe:</strong> For payment processing (subject to <a href="https://stripe.com/privacy" target="_blank">Stripe's Privacy Policy</a>).</li>
      <li><strong>OpenAI:</strong> Anonymized text snippets may be analyzed to detect scam patterns (subject to <a href="https://openai.com/policies/privacy-policy" target="_blank">OpenAI's Privacy Policy</a>).</li>
      <li><strong>Infrastructure providers:</strong> Cloud hosting and database services necessary to operate the app.</li>
      <li><strong>Law enforcement:</strong> Only when required by applicable law.</li>
    </ul>

    <h2>5. Data Retention</h2>
    <p>We retain your data for as long as your account is active. You may delete your account and all associated data at any time by contacting <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. Deleted data is purged from our systems within 30 days.</p>

    <h2>6. Security</h2>
    <p>All data is encrypted in transit (TLS 1.2+) and at rest. OAuth tokens are stored encrypted. We follow industry-standard security practices and conduct regular security reviews.</p>

    <h2>7. Children's Privacy</h2>
    <p>${APP_NAME} is not directed to children under 13. We do not knowingly collect personal information from children under 13.</p>

    <h2>8. Your Rights</h2>
    <p>Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data. Contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> to exercise these rights.</p>

    <h2>9. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or in-app notification. Continued use of the service after changes constitutes acceptance.</p>

    <h2>10. Contact</h2>
    <div class="card">
      <p><strong>Email:</strong> <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
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
    <p>${APP_NAME} provides AI-powered identity monitoring services including detection of social media impersonators, stolen photos, and data breaches. The Service is provided on a subscription basis with Free, Pro, and Premium tiers.</p>

    <h2>2. Account Registration</h2>
    <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 13 years old to use the Service.</p>

    <h2>3. Connected Social Accounts</h2>
    <p>By connecting a social media account you authorize ${APP_NAME} to access your public profile information in read-only mode for identity monitoring purposes. You represent that you own or have authorization to connect each account. You may disconnect accounts at any time.</p>

    <h2>4. Subscriptions and Payments</h2>
    <ul>
      <li><strong>Free tier:</strong> Limited monitoring for 1 account, manual scans every 14 days.</li>
      <li><strong>Pro tier:</strong> Up to 3 accounts, weekly automated scans, real-time alerts.</li>
      <li><strong>Premium tier:</strong> Unlimited accounts, daily deep scans, advanced intelligence.</li>
    </ul>
    <p>Paid subscriptions are billed in advance on a recurring basis. All subscriptions include a 7-day free trial for new subscribers. You may cancel at any time; cancellation takes effect at the end of the current billing period. No partial refunds are issued for unused periods.</p>

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
      <p><strong>Email:</strong> <a href="mailto:support@shieldid.app">support@shieldid.app</a></p>
      <p><strong>Website:</strong> <a href="https://${DOMAIN}">https://${DOMAIN}</a></p>
    </div>
  `));
});

export { DOMAIN };
export default router;
