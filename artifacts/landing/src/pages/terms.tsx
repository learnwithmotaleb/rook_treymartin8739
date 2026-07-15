import { Link } from "wouter";

const LAST_UPDATED = "July 15, 2026";
const APP_NAME = "Rook";
const SUPPORT_EMAIL = "support.rook@gmail.com";
const CONTACT_EMAIL = "support.rook@gmail.com";
const BUSINESS_PHONE = "+1 (832) 819-3114";
const BUSINESS_ADDRESS = "127 N Higgins Ave Suite 307D #2992, Missoula, MT 59802";
const BUSINESS_NAME = "Rook Identity Labs LLC";

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

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#070B12] text-slate-300">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <Link href="/">
            <img src="/landing/logo.png" alt="Rook" className="h-9 w-9 object-contain" />
          </Link>
          <Link href="/">
            <span className="font-bold text-lg text-white">ROOK</span>
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: {LAST_UPDATED}</p>

        <P>
          These Terms of Service ("Terms") govern your use of {APP_NAME} ("Service"). By downloading,
          installing, or using the Service you agree to these Terms. If you do not agree, do not use the
          Service.
        </P>

        <Section title="1. The Service">
          <P>
            {APP_NAME} provides AI-powered identity monitoring services including detection of social media
            impersonators and stolen photos. The Service is provided on a subscription basis with Free, Pro,
            and Premium tiers as described below.
          </P>
        </Section>

        <Section title="2. Account Registration">
          <P>
            You must provide accurate information when creating an account. Account creation and authentication
            is handled by <strong className="text-white">Clerk</strong>. You are responsible for maintaining
            the security of your account credentials. You must be at least 13 years old to use the Service.
          </P>
        </Section>

        <Section title="3. Connected Social Accounts">
          <P>
            By connecting a social media account you authorize {APP_NAME} to access your public profile
            information in read-only mode for identity monitoring purposes. You represent that you own or have
            authorization to connect each account. You may disconnect accounts at any time via{" "}
            <strong className="text-white">Profile → Connected Accounts</strong>.
          </P>
        </Section>

        <Section title="4. Subscriptions and Pricing">
          <P>
            {APP_NAME} offers three subscription tiers. All paid subscriptions include a{" "}
            <strong className="text-white">7-day free trial</strong> for new subscribers — you will not be
            charged during the trial period.
          </P>
          <UL>
            <li>
              <strong className="text-white">Free:</strong> 1 connected account, manual scans only, 1-day
              threat history. No charge.
            </li>
            <li>
              <strong className="text-white">Pro — $4.99/month</strong> (or $39.99/year): Up to 3 connected
              accounts, weekly automated scans, real-time push alerts, 7-day threat history.
            </li>
            <li>
              <strong className="text-white">Premium — $9.99/month</strong> (or $79.99/year): Up to 10
              connected accounts, daily deep scans, advanced AI analysis, 30-day threat history, priority
              support.
            </li>
          </UL>
          <P>
            <strong className="text-white">Billing and auto-renewal.</strong> Paid subscriptions are billed
            in advance on a recurring monthly or annual basis through the Apple App Store or Google Play
            Store. Your subscription <strong className="text-white">automatically renews</strong> unless you
            cancel at least 24 hours before the end of the current billing period. After your free trial, you
            will be charged the applicable subscription price unless you cancel before the trial ends.
          </P>
          <P>
            <strong className="text-white">Cancellation.</strong> You may cancel at any time through your
            device's subscription settings (iOS: Settings → [your name] → Subscriptions; Android: Google
            Play → Subscriptions). Cancellation takes effect at the end of the current paid period — access
            continues until then. No partial refunds are issued for unused time. Subscription management,
            refund eligibility, and billing disputes are subject to Apple's or Google's terms.
          </P>
          <P>
            <strong className="text-white">Price changes.</strong> We may change subscription prices with
            at least 30 days' notice. Your existing subscription continues at the current price until the
            next renewal after the effective date of the change.
          </P>
        </Section>

        <Section title="5. AI-Generated Content and Accuracy Disclaimer">
          <P>
            The Service uses artificial intelligence and machine learning to identify potential identity
            threats. <strong className="text-white">All AI-generated alerts, threat scores, and analyses are
            probabilistic estimates — they may contain errors, false positives, or false negatives.</strong>{" "}
            Results do not constitute legal advice, and {APP_NAME} makes no guarantee that all threats will
            be detected or that detected threats are accurate. You should independently verify any alert
            before taking action. {APP_NAME} is not liable for any action taken (or not taken) based on
            AI-generated results.
          </P>
        </Section>

        <Section title="6. Acceptable Use">
          <P>You agree not to:</P>
          <UL>
            <li>Use the Service to monitor accounts you do not own or have explicit authorization to monitor.</li>
            <li>Attempt to reverse engineer, scrape, or extract data from the Service or its APIs.</li>
            <li>Use the Service for any unlawful purpose or to harass, threaten, or intimidate others.</li>
            <li>Circumvent any rate limits, subscription tiers, or access controls.</li>
            <li>Resell, sublicense, or transfer access to the Service to third parties.</li>
          </UL>
          <P>
            Violation of this section may result in immediate account suspension or termination without
            refund.
          </P>
        </Section>

        <Section title="7. Intellectual Property">
          <P>
            {APP_NAME} and its licensors own all right, title, and interest in the Service, including all
            software, algorithms, designs, trademarks, and content we create. You retain ownership of your
            own content (your photos, posts, and profile information). You grant {APP_NAME} a limited,
            non-exclusive, royalty-free license to process your content solely to provide the identity
            monitoring service described in these Terms. We do not claim ownership of your personal content.
          </P>
        </Section>

        <Section title="8. Disclaimer of Warranties">
          <P>
            The Service is provided "as is" without warranty of any kind. We do not guarantee that all
            impersonators or threats will be detected. Monitoring coverage depends on platform API
            availability and our detection algorithms, which are continuously improving but not infallible.
          </P>
        </Section>

        <Section title="9. Limitation of Liability">
          <P>
            To the maximum extent permitted by law, {APP_NAME} shall not be liable for any indirect,
            incidental, special, or consequential damages arising from your use of the Service. Our total
            liability for any claim arising out of or relating to these Terms shall not exceed the amount
            you paid us in the 12 months preceding the claim.
          </P>
        </Section>

        <Section title="10. Dispute Resolution and Governing Law">
          <P>
            These Terms are governed by the laws of the State of Delaware, United States, without regard to
            conflict of law principles. Any dispute arising from these Terms or your use of the Service shall
            first be submitted to informal resolution by contacting{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-500 hover:underline">{SUPPORT_EMAIL}</a>.
            If not resolved within 30 days, disputes shall be resolved by binding individual arbitration
            under the rules of the American Arbitration Association (AAA), conducted in English.{" "}
            <strong className="text-white">You waive any right to participate in class actions or class-wide
            arbitration.</strong> Nothing in this section prevents either party from seeking injunctive or
            other equitable relief in a court of competent jurisdiction.
          </P>
          <P>
            Users in the EU/EEA may also submit disputes to the European Online Dispute Resolution platform
            at{" "}
            <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              ec.europa.eu/consumers/odr
            </a>.
          </P>
        </Section>

        <Section title="11. Termination">
          <P>
            We may suspend or terminate your account for violation of these Terms or for any other reason
            with reasonable notice. You may delete your account at any time via{" "}
            <strong className="text-white">Profile → Delete Account</strong>, which immediately and
            permanently deletes all your data. Upon termination, all licenses granted under these Terms
            cease.
          </P>
        </Section>

        <Section title="12. Changes to Terms">
          <P>
            We may update these Terms at any time. Material changes will be communicated via email or in-app
            notification at least 14 days before taking effect. Continued use of the Service after the
            effective date constitutes acceptance of updated Terms.
          </P>
        </Section>

        <Section title="13. Contact">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-1.5">
            <P><strong className="text-white">Company:</strong> {BUSINESS_NAME}</P>
            <P><strong className="text-white">Address:</strong> {BUSINESS_ADDRESS}</P>
            <P><strong className="text-white">Phone:</strong>{" "}<a href={`tel:${BUSINESS_PHONE.replace(/[^+\d]/g, "")}`} className="text-blue-500 hover:underline">{BUSINESS_PHONE}</a></P>
            <P><strong className="text-white">Support &amp; privacy:</strong>{" "}<a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-500 hover:underline">{SUPPORT_EMAIL}</a></P>
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-14 pt-6 border-t border-white/10 flex flex-wrap gap-4 text-sm text-slate-500">
          <Link href="/" className="hover:text-white transition-colors">← Back to Rook</Link>
          <span className="text-white/20">·</span>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <span className="text-white/20">·</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white transition-colors">{SUPPORT_EMAIL}</a>
          <span className="ml-auto">© {new Date().getFullYear()} {APP_NAME}</span>
        </div>
      </div>
    </div>
  );
}
