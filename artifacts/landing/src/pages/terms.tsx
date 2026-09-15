import { Link } from "wouter";

const LAST_UPDATED = "September 15, 2026";
const TERMS_VERSION = "2026-09-15-v4";
const APP_NAME = "Rook";
const SUPPORT_EMAIL = "support@tryrook.app";
const PRIVACY_EMAIL = "privacy@getrook.app";
const CONTACT_EMAIL = "support@tryrook.app";
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

function NoticeBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-purple-800/60 bg-purple-950/30 p-5 mb-5">
      {children}
    </div>
  );
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
        <p className="text-sm text-slate-500 mb-10">Last updated: {LAST_UPDATED} · Version {TERMS_VERSION}</p>

        <P>
          These Terms of Service ("Terms") govern your use of {APP_NAME} ("Service"), operated by{" "}
          <strong className="text-white">{BUSINESS_NAME}</strong>. By downloading, installing, or using the
          Service you agree to these Terms. If you do not agree, do not use the Service.
        </P>

        <P>
          <strong className="text-white">Independence.</strong> {APP_NAME} is not affiliated with,
          endorsed by, or connected to Meta, Instagram, Facebook, Google, X (Twitter), TikTok, Snapchat,
          LinkedIn, Apple, or any other platform. All trademarks belong to their respective owners.
        </P>

        <Section title="1. The Service">
          <P>
            {APP_NAME} provides AI-powered identity monitoring services including detection of social media
            impersonators and potential photo theft. Scan results are probabilistic estimates — see Section 5.
            The Service is provided in Free and Premium tiers.
          </P>
        </Section>

        <Section title="2. Eligibility and Account Registration">
          <P>
            You must be at least <strong className="text-white">17 years old</strong> to use the Service.
            By creating an account, you represent that you are 17 or older. You must provide accurate
            information at registration. Account authentication is handled by{" "}
            <strong className="text-white">Clerk</strong>. You are responsible for maintaining the security
            of your credentials and for all activity under your account.
          </P>
        </Section>

        <Section title="3. Biometric and Image-Derived Data — Written Release">
          <NoticeBox>
            <p className="text-purple-300 font-semibold mb-2">
              ⚠ Biometric Data Written Release (Illinois BIPA § 15(b) / Texas CUBI / GDPR Art. 9)
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              This section constitutes the written release required by the Illinois Biometric Information
              Privacy Act and Texas Capture or Use of Biometric Identifier Act, and records your explicit
              consent required under GDPR Article 9(2)(a) for processing of biometric-adjacent data.
            </p>
          </NoticeBox>

          <P>By accepting these Terms and the in-app Photo Processing Consent prompt, you:</P>
          <UL>
            <li>
              Acknowledge that you have received and read the written notice in the{" "}
              <Link href="/privacy" className="text-blue-500 hover:underline">Privacy Policy, Section 2</Link>,
              describing what image-derived data is collected, for what specific purpose, and for what
              length of term;
            </li>
            <li>
              Grant {APP_NAME} a <strong className="text-white">limited, revocable, non-exclusive</strong>{" "}
              license to derive AI-powered visual fingerprints from your public profile photos and to
              process them via our AI service providers, solely for the purpose of detecting potential
              impersonation of your identity on social media;
            </li>
            <li>
              Understand that this license terminates upon withdrawal of your photo-processing consent
              (available at{" "}
              <strong className="text-white">Profile → Settings → Privacy → Manage Photo Data</strong>) or
              upon account deletion, and that {APP_NAME} will delete all image-derived data within 30 days
              of termination;
            </li>
            <li>
              Acknowledge that {APP_NAME} does not sell, lease, trade, or otherwise profit from your
              image-derived data, and does not disclose it except to the processors described in the Privacy
              Policy for the stated purpose;
            </li>
            <li>Confirm you are the owner of, or are authorized to submit, the profile photos you provide.</li>
          </UL>
          <P>
            <strong className="text-white">
              You may withdraw this consent at any time
            </strong>{" "}
            without terminating your account or affecting your access to non-photo-based features of the
            Service.
          </P>
        </Section>

        <Section title="4. Connected Social Accounts">
          <P>
            By connecting a social media account you authorize {APP_NAME} to access your public profile in
            read-only mode for identity monitoring. You represent that you own or have authorization to
            connect each account. {APP_NAME} will never post, message, or take any action on your behalf.
            You may disconnect at any time via{" "}
            <strong className="text-white">Profile → Connected Accounts</strong>.
          </P>
        </Section>

        <Section title="5. AI-Generated Results — Accuracy Disclaimer">
          <P>
            The Service uses AI and machine learning to identify <em>potential</em> identity threats.{" "}
            <strong className="text-white">
              All alerts, threat scores, and analyses are probabilistic estimates. They may contain errors,
              false positives, and false negatives.
            </strong>{" "}
            Results are not legal determinations, and {APP_NAME} makes no guarantee that all threats will be
            detected or that any detected match is an actual impersonator. You must independently verify any
            alert before taking action. {APP_NAME} is not liable for actions taken or not taken based on
            Service results.
          </P>
        </Section>

        <Section title="6. Subscriptions and Payments">
          <P>
            {APP_NAME} offers a Free tier and a Rook Premium subscription. Eligible new subscribers may
            receive a <strong className="text-white">7-day introductory trial</strong>. Eligibility, localized
            pricing, and the first charge date are confirmed by the App Store or Google Play purchase sheet.
          </P>
          <UL>
            <li>
              <strong className="text-white">Free:</strong> 1 connected account, 1 manual scan per month,
              1 monitored image per scan, and basic scan results. No charge.
            </li>
            <li>
              <strong className="text-white">Rook Premium — $9.99/month</strong> (or $69.99/year): Unlimited
              connected accounts, scans, and monitored images; daily automated monitoring; push alerts; full
              evidence; 30-day threat history; advanced risk scoring; priority processing; and downloadable reports.
            </li>
          </UL>
          <P>
            <strong className="text-white">Billing and auto-renewal.</strong> Subscriptions are billed in
            advance and <strong className="text-white">automatically renew</strong> unless cancelled at
            least 24 hours before the end of the current billing period. After your trial, you will be
            charged the applicable price unless you cancel before the trial ends.
          </P>
          <P>
            <strong className="text-white">Cancellation.</strong> Cancel anytime through iOS Settings →
            Subscriptions or Google Play → Subscriptions. Cancellation takes effect at the end of the
            current paid period — access continues until then. No partial refunds for unused time.
            Billing disputes subject to Apple's or Google's terms.
          </P>
          <P>
            <strong className="text-white">Price changes.</strong> Price changes will be communicated with
            at least 30 days' notice.
          </P>
        </Section>

        <Section title="7. Acceptable Use">
          <P>You agree not to:</P>
          <UL>
            <li>Use the Service to monitor accounts you do not own or are not authorized to monitor.</li>
            <li>Reverse engineer, scrape, or extract data from the Service or APIs.</li>
            <li>Use the Service for any unlawful purpose or to harass, threaten, or intimidate others.</li>
            <li>Circumvent rate limits, subscription tiers, or access controls.</li>
            <li>Submit someone else's photos as your own to generate false reports about them.</li>
            <li>Resell, sublicense, or transfer access to the Service to third parties.</li>
          </UL>
          <P>Violations may result in immediate account termination without refund.</P>
        </Section>

        <Section title="8. Intellectual Property">
          <P>
            {APP_NAME} owns all right, title, and interest in the Service, including software, algorithms,
            designs, and trademarks. You retain ownership of your own photos and content. The biometric
            data license granted in Section 3 is limited to providing the Service and terminates upon
            consent withdrawal or account deletion.
          </P>
        </Section>

        <Section title="9. Disclaimer of Warranties">
          <P>
            The Service is provided "as is." We do not warrant complete detection of all impersonators or
            threats. Coverage depends on platform API availability and our detection algorithms, which are
            improving but not infallible.
          </P>
        </Section>

        <Section title="10. Limitation of Liability">
          <P>
            To the maximum extent permitted by law, {APP_NAME} shall not be liable for any indirect,
            incidental, special, or consequential damages. Our total liability for any claim shall not
            exceed the amount you paid us in the 12 months preceding the claim. Nothing in this section
            limits liability for gross negligence, willful misconduct, or where prohibited by applicable
            law (including BIPA statutory damages).
          </P>
        </Section>

        <Section title="11. Termination and Account Deletion">
          <P>
            We may suspend or terminate your account for violation of these Terms. You may delete your
            account at any time via{" "}
            <strong className="text-white">Profile → Delete Account</strong>, which removes your data from
            active systems immediately; production backups are purged within 30 days. Consent records are
            retained for 7 years as legally required. Upon termination, the biometric data license in
            Section 3 terminates and all image-derived data is deleted pursuant to the retention schedule
            in the Privacy Policy.
          </P>
        </Section>

        <Section title="12. Dispute Resolution and Governing Law">
          <P>
            These Terms are governed by the laws of the State of Delaware, without regard to conflict of
            law principles. Disputes shall first be submitted to informal resolution by emailing{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-500 hover:underline">{SUPPORT_EMAIL}</a>.
            If not resolved in 30 days, disputes shall be resolved by binding individual arbitration under
            AAA rules, conducted in English.{" "}
            <strong className="text-white">
              You waive the right to participate in class actions or class-wide arbitration.
            </strong>{" "}
            Either party may seek injunctive or equitable relief in a court of competent jurisdiction.
          </P>
          <P>
            EU/EEA users may also contact the European Online Dispute Resolution platform at{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              ec.europa.eu/consumers/odr
            </a>.
          </P>
          <P>
            <strong className="text-white">Note for Illinois residents:</strong> Nothing in this
            arbitration clause is intended to waive any rights under the Illinois Biometric Information
            Privacy Act that are not waivable by contract.
          </P>
        </Section>

        <Section title="13. Changes to Terms">
          <P>
            We may update these Terms at any time. Material changes will be communicated via email or
            in-app notification at least 14 days before taking effect. Changes affecting how we process
            biometric or image-derived data require fresh explicit consent before they take effect.
            Continued use after the effective date constitutes acceptance of non-material changes.
          </P>
        </Section>

        <Section title="14. Contact">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-1.5">
            <P><strong className="text-white">Company:</strong> {BUSINESS_NAME}</P>
            <P><strong className="text-white">Address:</strong> {BUSINESS_ADDRESS}</P>
            <P><strong className="text-white">Phone:</strong>{" "}<a href={`tel:${BUSINESS_PHONE.replace(/[^+\d]/g, "")}`} className="text-blue-500 hover:underline">{BUSINESS_PHONE}</a></P>
            <P><strong className="text-white">Privacy &amp; biometric inquiries:</strong>{" "}<a href={`mailto:${PRIVACY_EMAIL}`} className="text-blue-500 hover:underline">{PRIVACY_EMAIL}</a></P>
            <P><strong className="text-white">General support:</strong>{" "}<a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-500 hover:underline">{SUPPORT_EMAIL}</a></P>
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-14 pt-6 border-t border-white/10 flex flex-wrap gap-4 text-sm text-slate-500">
          <Link href="/" className="hover:text-white transition-colors">← Back to Rook</Link>
          <span className="text-white/20">·</span>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <span className="text-white/20">·</span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition-colors">{CONTACT_EMAIL}</a>
          <span className="ml-auto">© {new Date().getFullYear()} {APP_NAME}</span>
        </div>
      </div>
    </div>
  );
}
