import { Link } from "wouter";

const LAST_UPDATED = "June 15, 2026";
const APP_NAME = "ShieldID";
const CONTACT_EMAIL = "privacy@shieldid.app";
const SUPPORT_EMAIL = "support@shieldid.app";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-400 leading-relaxed mb-3">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-outside ml-5 text-slate-400 leading-relaxed mb-3 space-y-1.5">{children}</ul>;
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#070B12] text-slate-300">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <Link href="/">
            <img src="/landing/logo.png" alt="ShieldID" className="h-9 w-9 object-contain" />
          </Link>
          <Link href="/">
            <span className="font-bold text-lg text-white">Shield<span className="text-blue-500">ID</span></span>
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: {LAST_UPDATED}</p>

        <P>
          {APP_NAME} ("we", "our", "us") is an AI-powered identity protection service that monitors social
          platforms for impersonators and stolen photos. This Privacy Policy explains how we collect, use, and
          protect your information.
        </P>

        <Section title="1. Information We Collect">
          <P>We collect information you provide directly and information obtained through connected social accounts:</P>
          <UL>
            <li><strong className="text-white">Account information:</strong> Name, email address, and username when you register. Authentication is handled by <strong className="text-white">Clerk</strong> — we receive a secure user identifier (Clerk user ID) and basic profile info, but never your password.</li>
            <li><strong className="text-white">Connected platform data:</strong> When you authorize {APP_NAME} to access a social platform, we receive read-only access to your public profile information — username, profile photo, follower count, and public posts.</li>
            <li><strong className="text-white">Identity fingerprint data:</strong> Perceptual hashes (not raw images) derived from your public photos, used to detect visually similar stolen content.</li>
            <li><strong className="text-white">Scan results:</strong> Records of monitoring activity, detected threats, and impersonation alerts associated with your account. Stored in a managed <strong className="text-white">PostgreSQL</strong> database.</li>
            <li><strong className="text-white">Payment information:</strong> Subscriptions are managed by <strong className="text-white">RevenueCat</strong> and billed through the Apple App Store or Google Play Store. We store only your subscription tier and entitlement status — we never see or store your payment card details.</li>
            <li><strong className="text-white">Usage data:</strong> App interactions, feature usage, and device information to improve the service.</li>
          </UL>
        </Section>

        <Section title="2. How We Use Your Information">
          <UL>
            <li>To scan connected social platforms for impersonators and identity threats.</li>
            <li>To build and maintain your identity fingerprint for comparison against detected accounts.</li>
            <li>To send alerts when threats are detected (push notifications, per your preferences).</li>
            <li>To manage your subscription tier and feature access via RevenueCat.</li>
            <li>To improve our detection algorithms and service quality.</li>
          </UL>
        </Section>

        <Section title="3. Platform OAuth Access">
          <P>When you connect a social media account (e.g. Instagram, X, TikTok), {APP_NAME} requests <strong className="text-white">read-only</strong> OAuth permissions. We:</P>
          <UL>
            <li>Never post, comment, like, or take any action on your behalf.</li>
            <li>Never access your private messages or direct messages.</li>
            <li>Only read your public profile data and public media.</li>
            <li>Store OAuth access tokens encrypted at rest to enable ongoing monitoring.</li>
            <li>Use tokens solely to fetch your profile data for impersonation comparison.</li>
          </UL>
          <P>You can revoke access at any time from the platform's settings page or by disconnecting the account in {APP_NAME}.</P>
        </Section>

        <Section title="4. Data Sharing and Third-Party Processors">
          <P>We do not sell your personal information. We share data only with the following processors:</P>
          <UL>
            <li><strong className="text-white">Clerk:</strong> Handles user authentication, account creation, and session management. Clerk processes your email address and device information subject to the <a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Clerk Privacy Policy</a>.</li>
            <li><strong className="text-white">RevenueCat:</strong> Manages subscription entitlements and billing reconciliation. Payments are processed directly by Apple or Google — RevenueCat never stores your full payment card data. Subject to the <a href="https://www.revenuecat.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">RevenueCat Privacy Policy</a>.</li>
            <li><strong className="text-white">Google Cloud Vision:</strong> Photo URLs from your connected accounts are sent to Google's Web Detection API to find where those images appear on the open web. Subject to the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google Privacy Policy</a>.</li>
            <li><strong className="text-white">OpenAI:</strong> Anonymized text snippets may be analyzed to generate AI threat explanations. Subject to the <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenAI Privacy Policy</a>.</li>
            <li><strong className="text-white">PostgreSQL (Replit-managed):</strong> Your account data, scan results, and threat history are stored in a managed PostgreSQL database. Data is encrypted at rest and in transit.</li>
            <li><strong className="text-white">Replit:</strong> Cloud hosting infrastructure for the {APP_NAME} API server and web presence. Subject to the <a href="https://replit.com/site/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Replit Privacy Policy</a>.</li>
            <li><strong className="text-white">Law enforcement:</strong> Only when required by applicable law.</li>
          </UL>
        </Section>

        <Section title="5. Automated Decision-Making">
          <P>
            {APP_NAME} uses AI algorithms to automatically analyze social media content and generate threat scores
            and alerts. These scores are probabilistic estimates based on pattern matching — they are not legal
            determinations and may contain errors. You have the right to request human review of any automated
            alert by contacting us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-500 hover:underline">{CONTACT_EMAIL}</a>.
            All AI-generated results are labeled as such within the app.
          </P>
        </Section>

        <Section title="6. Data Retention">
          <UL>
            <li><strong className="text-white">Account data:</strong> Retained until account deletion; purged within 30 days thereafter.</li>
            <li><strong className="text-white">Threat history:</strong> Retained for 30 days (Premium), 7 days (Pro), 1 day (Free) from detection, then automatically deleted.</li>
            <li><strong className="text-white">Identity fingerprint data (perceptual hashes):</strong> Retained while account is active; deleted upon account deletion.</li>
            <li><strong className="text-white">OAuth tokens:</strong> Deleted immediately upon account disconnection or account deletion.</li>
            <li><strong className="text-white">Anonymized usage analytics:</strong> May be retained for up to 2 years in aggregated, non-identifiable form.</li>
          </UL>
          <P>
            You may delete your account and all associated data at any time directly in the app under{" "}
            <strong className="text-white">Profile → Delete Account</strong>. Data is purged from our production
            systems within 30 days of deletion.
          </P>
        </Section>

        <Section title="7. Security">
          <P>
            All data is encrypted in transit (TLS 1.2+) and at rest. OAuth tokens are stored encrypted.
            Authentication is handled by Clerk with industry-standard session management. We follow
            industry-standard security practices and conduct regular security reviews.
          </P>
        </Section>

        <Section title="8. Children's Privacy">
          <P>
            {APP_NAME} is not directed to children under 13. We do not knowingly collect personal information
            from children under 13. If you believe a child under 13 has provided us personal information,
            contact us immediately at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-500 hover:underline">{CONTACT_EMAIL}</a>.
          </P>
        </Section>

        <Section title="9. Your Rights (GDPR — EU/EEA/UK Residents)">
          <P>If you are located in the European Union, European Economic Area, or United Kingdom, you have the following rights under the GDPR:</P>
          <UL>
            <li><strong className="text-white">Right of Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li><strong className="text-white">Right to Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong className="text-white">Right to Erasure:</strong> Request deletion of your personal data via <strong className="text-white">Profile → Delete Account</strong> or by contacting us.</li>
            <li><strong className="text-white">Right to Restrict Processing:</strong> Request that we limit how we use your data.</li>
            <li><strong className="text-white">Right to Data Portability:</strong> Request your personal data in a structured, machine-readable format.</li>
            <li><strong className="text-white">Right to Object:</strong> Object to processing based on legitimate interests, including profiling.</li>
            <li><strong className="text-white">Right to Human Review:</strong> Request human review of any automated decision that significantly affects you.</li>
            <li><strong className="text-white">Right to Withdraw Consent:</strong> Where processing is based on consent, you may withdraw it at any time without affecting prior processing.</li>
          </UL>
          <P>
            Our legal basis for processing personal data is: <em>contract performance</em> (providing the
            service you signed up for), <em>legitimate interests</em> (fraud prevention, security), and{" "}
            <em>consent</em> (marketing communications, where applicable). To exercise any GDPR right,
            contact{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-500 hover:underline">{CONTACT_EMAIL}</a>.
            We will respond within 30 days. You also have the right to lodge a complaint with your local
            supervisory authority.
          </P>
        </Section>

        <Section title="10. Your Rights (CCPA — California Residents)">
          <P>If you are a California resident, the California Consumer Privacy Act (CCPA) gives you additional rights:</P>
          <UL>
            <li><strong className="text-white">Right to Know:</strong> Request disclosure of the categories and specific pieces of personal information we collect, use, disclose, or sell.</li>
            <li><strong className="text-white">Right to Delete:</strong> Request deletion via <strong className="text-white">Profile → Delete Account</strong> or by contacting us.</li>
            <li><strong className="text-white">Right to Opt-Out of Sale:</strong> We do not sell personal information. No opt-out is required.</li>
            <li><strong className="text-white">Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any CCPA rights.</li>
            <li><strong className="text-white">Right to Correct:</strong> Request correction of inaccurate personal information.</li>
          </UL>
          <P>
            To exercise CCPA rights, contact{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-500 hover:underline">{CONTACT_EMAIL}</a>{" "}
            with subject "CCPA Request". We will respond within 45 days.
          </P>
        </Section>

        <Section title="11. Changes to This Policy">
          <P>
            We may update this Privacy Policy from time to time. We will notify you of material changes via
            email or in-app notification. Continued use of the service after changes constitutes acceptance.
          </P>
        </Section>

        <Section title="12. Contact">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-1.5">
            <P><strong className="text-white">Privacy inquiries:</strong>{" "}<a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-500 hover:underline">{CONTACT_EMAIL}</a></P>
            <P><strong className="text-white">General support:</strong>{" "}<a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-500 hover:underline">{SUPPORT_EMAIL}</a></P>
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-14 pt-6 border-t border-white/10 flex flex-wrap gap-4 text-sm text-slate-500">
          <Link href="/" className="hover:text-white transition-colors">← Back to ShieldID</Link>
          <span className="text-white/20">·</span>
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <span className="text-white/20">·</span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition-colors">{CONTACT_EMAIL}</a>
          <span className="ml-auto">© {new Date().getFullYear()} {APP_NAME}</span>
        </div>
      </div>
    </div>
  );
}
