import { Link } from "wouter";

const LAST_UPDATED = "September 15, 2026";
const TERMS_VERSION = "2026-09-15-v4";
const APP_NAME = "Rook";
const PRIVACY_EMAIL = "privacy@getrook.app";
const SUPPORT_EMAIL = "support@getrook.app";
const CONTACT_EMAIL = "support@getrook.app";
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

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-2">{title}</h3>
      {children}
    </div>
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

export default function Privacy() {
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

        <h1 className="text-3xl font-extrabold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-2">Last updated: {LAST_UPDATED} · Version {TERMS_VERSION}</p>
        <p className="text-sm text-slate-500 mb-10">Data Controller: {BUSINESS_NAME}</p>

        <P>
          {APP_NAME} ("we", "our", "us") is an AI-powered identity protection service operated by{" "}
          <strong className="text-white">{BUSINESS_NAME}</strong>. This Privacy Policy explains how we
          collect, use, share, and protect your information, and what rights you have over that information.
        </P>

        <P>
          <strong className="text-white">Independence.</strong> {APP_NAME} is not affiliated with,
          endorsed by, or connected to Meta, Instagram, Facebook, Google, X (Twitter), TikTok, Snapchat,
          LinkedIn, YouTube, Apple, or any other platform we search or integrate with. All trademarks
          belong to their respective owners.
        </P>

        <Section title="1. Information We Collect">
          <UL>
            <li>
              <strong className="text-white">Account information:</strong> Name, email address, and
              username at registration. Authentication is managed by{" "}
              <strong className="text-white">Clerk</strong> — we receive a secure user identifier and
              basic profile info; we never receive or store your password.
            </li>
            <li>
              <strong className="text-white">Connected platform data:</strong> When you authorize{" "}
              {APP_NAME} to access a social platform, we receive read-only access to your public profile
              — username, profile photo URL, and public media.
            </li>
            <li>
              <strong className="text-white">Image-derived identity data:</strong> AI-derived visual
              fingerprints derived from your public profile photos.
              See Section 2 for the full written notice required by applicable biometric privacy laws.
            </li>
            <li>
              <strong className="text-white">Scan results:</strong> Records of monitoring activity,
              potential matches, and alerts stored in a managed PostgreSQL database.
            </li>
            <li>
              <strong className="text-white">Payment information:</strong> Subscriptions are managed by{" "}
              <strong className="text-white">RevenueCat</strong> through Apple App Store or Google Play.
              We store only your subscription tier — we never see your payment card number or billing address.
            </li>
            <li>
              <strong className="text-white">Device and usage data:</strong> App interactions, device
              identifiers for push notifications, and feature usage to improve the service.
            </li>
            <li>
              <strong className="text-white">Consent records:</strong> Timestamps and version numbers of
              your acceptance of Terms, Privacy Policy, and photo-processing consent. Retained as a legal
              compliance record.
            </li>
            <li>
              <strong className="text-white">Age confirmation:</strong> A timestamp recording that you
              declared you are 17 or older at signup. No date of birth is collected or stored.
            </li>
          </UL>
        </Section>

        <Section title="2. Face Data, Biometric and Image-Derived Data — Written Notice">
          <NoticeBox>
            <p className="text-purple-300 font-semibold mb-2">
              ⚠ Required Written Notice (Illinois BIPA / Texas CUBI / GDPR Article 9)
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              This section constitutes the written notice required by the Illinois Biometric Information
              Privacy Act (740 ILCS 14), the Texas Capture or Use of Biometric Identifier Act
              (Tex. Bus. &amp; Com. Code § 503.001), and analogous state and international privacy laws
              before the collection of biometric or biometric-adjacent data.
            </p>
          </NoticeBox>

          <SubSection title="What Face and Photo Data We Collect">
            <P>{APP_NAME} processes images that may contain a human face, including profile photos, public post images, reel thumbnails, a compressed avatar you select, and reference photos you submit. During a scan, we may process raw image bytes, base64-encoded image content, public image URLs, platform media identifiers, and external-match image URLs. Alert evidence may retain image URLs until the alert is deleted under Section 7.</P>
            <UL>
              <li>
                <strong className="text-white">Perceptual image hashes:</strong> A 64-bit
                image-structure fingerprint computed from a 9×8 grayscale thumbnail, together with its
                source URL and media metadata.
              </li>
              <li>
                <strong className="text-white">Image embeddings:</strong> Floating-point vectors
                describing overall visual similarity, together with similarity scores and visual-fingerprint metadata.
              </li>
              <li>
                <strong className="text-white">What we do not collect:</strong> Rook does not detect
                or map facial landmarks, measure facial geometry, create a faceprint or facial-recognition
                template, identify an unknown person from their face, or use a face for authentication.
                Image hashes and embeddings compare images as a whole and cannot reconstruct the source image.
              </li>
            </UL>
          </SubSection>

          <SubSection title="Purpose of Collection">
            <P>
              <strong className="text-white">Sole purpose:</strong> We use face-containing photos and
              derived image data to index user-authorized reference images, perform reverse-image and
              visual-similarity searches, compare potential impersonator accounts, display evidence in
              security alerts, and maintain the avatar selected by the user. We do not use this data to
              identify people by their faces, authenticate users, make legal or eligibility decisions,
              train advertising profiles, sell data, or train third-party AI models.
            </P>
          </SubSection>

          <SubSection title="Length of Retention">
            <UL>
              <li>
                 <strong className="text-white">Face and photo data:</strong> Hashes, source URLs,
                 embeddings, visual fingerprints, the stored avatar, image URLs in alert evidence, and
                 threat-level image hashes are retained while needed for active monitoring and deleted
                 from active systems on account deletion, photo-data deletion, or consent withdrawal.
                 Backups are purged within 30 days where applicable.
              </li>
              <li>
                <strong className="text-white">Consent withdrawal:</strong> You may withdraw photo-processing
                consent at any time at{" "}
                 <strong className="text-white">Profile → Settings → Privacy</strong>. Face and photo
                 data is deleted from active systems and photo scanning is disabled. Text-only scan history
                 may remain, and consent records are retained for seven years as evidence of compliance.
              </li>
              <li>
                <strong className="text-white">Maximum retention:</strong> Photo-derived data is not retained
                for more than 3 years from collection, or 1 year after the purpose is fulfilled (whichever
                is sooner), consistent with Illinois BIPA § 15(a) and Texas CUBI requirements.
              </li>
            </UL>
          </SubSection>

          <SubSection title="Third-Party Services That Receive Photo Data">
            <UL>
              <li>
                <strong className="text-white">Google Cloud Vision:</strong> Receives a
                user-authorized image URL or image bytes to perform Web Detection and locate visually
                matching public pages. Google does not receive social-account credentials.
                Governed by the{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  Google Privacy Policy
                </a>{" "}and Google Cloud Data Processing Addendum. Google does not retain submitted
                images for model training under applicable API terms.
              </li>
              <li>
                <strong className="text-white">OpenAI:</strong> May receive user-authorized image
                content and limited alert context for visual analysis and security explanations. API data
                is not used to train OpenAI models by default. Governed by the{" "}
                <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  OpenAI Privacy Policy
                </a>. {APP_NAME} configures our AI providers to minimize data retention where available.
              </li>
              <li>
                <strong className="text-white">Replit infrastructure:</strong> Hosts our API and managed
                PostgreSQL database, including stored avatars, hashes, embeddings, visual metadata, source
                URLs, and alert evidence. Access is limited to the authenticated user and authorized operations personnel.
              </li>
              <li>
                <strong className="text-white">Web search service:</strong> Your name and
                username (text only — no images) are used as search queries to find publicly
                discoverable results. No image data is transmitted.
              </li>
            </UL>
          </SubSection>

          <SubSection title="Your Consent and Withdrawal Rights">
            <P>
              By accepting the Terms of Service and the separate in-app Photo Processing Consent prompt,
              you provide the written release required under Illinois BIPA § 15(b) and Texas CUBI, and the
              explicit consent required under GDPR Article 9(2)(a).{" "}
              <strong className="text-white">
                You may withdraw this consent at any time
              </strong>{" "}
              without penalty by going to{" "}
              <strong className="text-white">
                Profile → Settings → Privacy → Withdraw Consent &amp; Delete Photo Data
              </strong>. Upon withdrawal, the face and photo data listed above is deleted from active
              systems and photo-based scanning is disabled. Text-based and username-based monitoring
              continues. Consent records are retained for seven years, and backups containing deleted
              data are purged within 30 days where applicable.
            </P>
          </SubSection>

          <SubSection title="No Sale or Profit from Biometric Data">
            <P>
              {APP_NAME} does not sell, lease, trade, or otherwise profit from your image-derived data. We
              do not disclose it to any party other than the processors listed above, and only for the stated
              purpose of providing the identity monitoring service.
            </P>
          </SubSection>

          <SubSection title="Security Standard">
            <P>
              Image-derived data is stored with the same standard of care as other confidential information:
              encrypted at rest in PostgreSQL, encrypted in transit via TLS 1.2+, access-controlled to the
              authenticated user's account, and subject to our security review practices.
            </P>
          </SubSection>
        </Section>

        <Section title="3. How We Use Your Information">
          <UL>
            <li>To search social platforms for accounts that may be impersonating you or using your photos.</li>
            <li>To build and maintain your protection profile for comparison against detected accounts.</li>
            <li>To send push notifications when potential matches are found (with your permission).</li>
            <li>To manage your subscription tier and feature access.</li>
            <li>To improve our detection using anonymized, aggregated data.</li>
            <li>To maintain legally required records of consent.</li>
          </UL>
        </Section>

        <Section title="4. Platform OAuth Access">
          <P>When you connect a social media account, {APP_NAME} requests <strong className="text-white">read-only</strong> OAuth permissions. We:</P>
          <UL>
            <li>Never post, comment, like, or take any action on your behalf.</li>
            <li>Never access your private messages or direct messages.</li>
            <li>Only read your public profile data and public media.</li>
            <li>Store OAuth access tokens encrypted at rest for ongoing monitoring.</li>
            <li>Use tokens solely to fetch your profile data for impersonation comparison.</li>
          </UL>
          <P>
            You can disconnect any account at any time from{" "}
            <strong className="text-white">Profile → Connected Accounts</strong>. Disconnecting immediately
            deletes the stored OAuth token.
          </P>
        </Section>

        <Section title="5. Data Sharing and Sub-Processors">
          <P>We do not sell your personal information. We share data only with the following processors under contractual data protection obligations:</P>
          <UL>
            <li><strong className="text-white">Clerk</strong> — Authentication and session management. Processes your email and device information. <a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Privacy Policy</a>.</li>
            <li><strong className="text-white">RevenueCat</strong> — Subscription entitlements. Payments processed by Apple/Google directly. <a href="https://www.revenuecat.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Privacy Policy</a>.</li>
            <li><strong className="text-white">Google</strong> — AI image analysis for detecting similar images on the web. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Privacy Policy</a>.</li>
            <li><strong className="text-white">OpenAI</strong> — AI-powered visual analysis of photo content. <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Privacy Policy</a>.</li>
            <li><strong className="text-white">Web Search Provider</strong> — Text search queries only (name, username). No image data.</li>
            <li><strong className="text-white">Replit</strong> — Cloud hosting for the {APP_NAME} API and database. <a href="https://replit.com/site/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Privacy Policy</a>.</li>
            <li><strong className="text-white">Law enforcement</strong> — Only when required by valid legal process, and only where we are legally permitted to notify you.</li>
          </UL>

          <SubSection title="International Data Transfers">
            <P>
              All processors listed above are based in the United States. If you are in the EU, EEA, or UK,
              your data is transferred to the US under{" "}
              <strong className="text-white">Standard Contractual Clauses (SCCs)</strong> approved by the
              European Commission, incorporated by reference into our agreements with each processor. For
              questions about transfer mechanisms, contact{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-blue-500 hover:underline">{PRIVACY_EMAIL}</a>.
            </P>
          </SubSection>
        </Section>

        <Section title="6. Automated Decision-Making">
          <P>
            {APP_NAME} uses AI to automatically generate threat scores and alerts. These are{" "}
            <strong className="text-white">probabilistic estimates — not legal determinations</strong> — and
            may contain errors (false positives or false negatives). No automated decision produces a legal
            or similarly significant effect on you. You may dismiss any alert in the app, request human
            review by emailing{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-500 hover:underline">{CONTACT_EMAIL}</a>,
            and download your data to verify what we hold.
          </P>
        </Section>

        <Section title="7. Data Retention and Deletion">
          <UL>
            <li><strong className="text-white">Account data:</strong> Retained while your account is active. Deleted from active systems immediately upon account deletion; production backups purged within 30 days.</li>
            <li><strong className="text-white">Threat history:</strong> Retained for up to 30 days under current Free and Premium plans, then automatically deleted.</li>
            <li><strong className="text-white">Face and photo data:</strong> Stored avatars, hashes, embeddings, visual fingerprints, source URLs, image URLs in alert evidence, and threat-level image hashes are retained while needed for active monitoring and never beyond 3 years from collection. They are deleted from active systems on account deletion, photo-data deletion, or consent withdrawal; backups are purged within 30 days where applicable.</li>
            <li><strong className="text-white">OAuth tokens:</strong> Deleted immediately upon account disconnection or account deletion.</li>
            <li><strong className="text-white">Consent records:</strong> Retained for 7 years after account deletion as a legal compliance record.</li>
            <li><strong className="text-white">Anonymized usage analytics:</strong> May be retained up to 2 years in aggregated, non-identifiable form.</li>
          </UL>
          <P>
            Delete your account anytime under{" "}
            <strong className="text-white">Profile → Delete Account</strong>. Account-associated data is
            removed from active systems; legally required consent records are retained for seven years,
            and backups are purged within 30 days where applicable.
          </P>
        </Section>

        <Section title="8. Data Export (Portability)">
               <P>
                 You can download a machine-readable copy of personal data currently accessible for your account from{" "}
            <strong className="text-white">Profile → Settings → Privacy → Download My Data</strong>.
                 The export includes your profile and avatar metadata/value, connected-account metadata (never
                 OAuth secrets), scan history, threat records, consent logs, photo hashes/source URLs,
                 identity embeddings, and related visual-fingerprint data in JSON format.
          </P>
        </Section>

        <Section title="9. Security">
          <P>
            All data is encrypted in transit (TLS 1.2+) and at rest. OAuth tokens are stored encrypted.
            Authentication is managed by Clerk with industry-standard session controls. All API endpoints
            are rate-limited to prevent abuse. We conduct regular security reviews.
          </P>
        </Section>

        <Section title="10. Minimum Age">
          <P>
            {APP_NAME} requires users to be at least <strong className="text-white">17 years old</strong>.
            By creating an account, you represent that you meet this requirement. We do not knowingly collect
            personal information from anyone under 17. If you believe a minor has registered, contact us
            immediately at{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="text-blue-500 hover:underline">{PRIVACY_EMAIL}</a>{" "}
            and we will delete the account promptly.
          </P>
        </Section>

        <Section title="11. Your Rights — EU/EEA/UK Residents (GDPR)">
          <P>If you are in the EU, EEA, or UK, you have the following rights under the GDPR (Art. 15–22):</P>
          <UL>
            <li><strong className="text-white">Access (Art. 15):</strong> Request a copy of your personal data. Available immediately via in-app data export.</li>
            <li><strong className="text-white">Rectification (Art. 16):</strong> Request correction of inaccurate data.</li>
            <li><strong className="text-white">Erasure (Art. 17):</strong> Delete your account via <strong className="text-white">Profile → Delete Account</strong>, or contact us.</li>
            <li><strong className="text-white">Restrict Processing (Art. 18):</strong> Request that we limit processing while a dispute is resolved.</li>
            <li><strong className="text-white">Data Portability (Art. 20):</strong> Download your data in structured JSON format via <strong className="text-white">Profile → Settings → Privacy → Download My Data</strong>.</li>
            <li><strong className="text-white">Object (Art. 21):</strong> Object to processing based on legitimate interests.</li>
            <li><strong className="text-white">Withdraw Consent (Art. 7(3)):</strong> Withdraw photo-processing consent at any time via <strong className="text-white">Profile → Settings → Privacy → Withdraw Consent &amp; Delete Photo Data</strong>, without affecting the lawfulness of prior processing.</li>
            <li><strong className="text-white">Human Review (Art. 22):</strong> Request human review of any automated decision by emailing <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-500 hover:underline">{CONTACT_EMAIL}</a>.</li>
          </UL>
          <P>
            <strong className="text-white">Legal bases (Art. 6):</strong>{" "}
            <em>Contract performance</em> — providing the service you signed up for;{" "}
            <em>Legitimate interests</em> — security and fraud prevention;{" "}
            <em>Explicit consent (Art. 9)</em> — photo/image processing for biometric-adjacent data.
          </P>
          <P>
            To exercise any right, contact{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="text-blue-500 hover:underline">{PRIVACY_EMAIL}</a>.
            We respond within <strong className="text-white">one calendar month</strong> (extendable by two
            further months for complex requests, with notice). You also have the right to lodge a complaint
            with your local supervisory authority (e.g., the ICO in the UK, or your EU Member State DPA).
          </P>
        </Section>

        <Section title="12. Your Rights — US State Residents">
          <SubSection title="Illinois — Biometric Information Privacy Act (BIPA)">
            <P>
              Illinois residents have the right to: (1) know whether their biometric data is being collected;
              (2) request a copy of written releases or consent records; (3) have biometric data destroyed
              pursuant to the retention schedule above. Contact{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-blue-500 hover:underline">{PRIVACY_EMAIL}</a>{" "}
              with subject "BIPA Request."
            </P>
          </SubSection>
          <SubSection title="Texas — Capture or Use of Biometric Identifier Act (CUBI)">
            <P>
              Texas residents have the rights described under CUBI, including notice before capture, consent
              before use, prohibition on sale, and destruction when the purpose is no longer satisfied.
              Contact{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-blue-500 hover:underline">{PRIVACY_EMAIL}</a>{" "}
              with subject "Texas CUBI Request."
            </P>
          </SubSection>
          <SubSection title="California — CCPA/CPRA">
            <UL>
              <li><strong className="text-white">Right to Know:</strong> Disclosure of categories and specific pieces of personal information we collect.</li>
              <li><strong className="text-white">Right to Delete:</strong> Via <strong className="text-white">Profile → Delete Account</strong> or contact us.</li>
              <li><strong className="text-white">Right to Opt-Out of Sale:</strong> We do not sell personal information.</li>
              <li><strong className="text-white">Right to Correct:</strong> Request correction of inaccurate information.</li>
              <li><strong className="text-white">Right to Limit Sensitive Personal Information:</strong> Image-derived data may qualify as sensitive personal information under CPRA. Contact us to limit its use to service provision only.</li>
              <li><strong className="text-white">Non-Discrimination:</strong> We will not discriminate for exercising CCPA/CPRA rights.</li>
            </UL>
            <P>Contact <a href={`mailto:${PRIVACY_EMAIL}`} className="text-blue-500 hover:underline">{PRIVACY_EMAIL}</a> with subject "CCPA Request". We respond within 45 days.</P>
          </SubSection>
          <SubSection title="Virginia, Colorado, Connecticut, and Other State Privacy Laws">
            <P>
              Residents of states with comprehensive privacy laws have similar access, deletion, correction,
              portability, and opt-out rights. Contact{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-blue-500 hover:underline">{PRIVACY_EMAIL}</a>{" "}
              to exercise any state privacy right.
            </P>
          </SubSection>
        </Section>

        <Section title="13. Changes to This Policy">
          <P>
            We will notify you of material changes via email and in-app notification at least 14 days before
            they take effect. For changes affecting how we process biometric or image-derived data, we will
            obtain fresh explicit consent before continuing to process under the new terms. Continued use
            after the effective date constitutes acceptance of non-material changes.
          </P>
        </Section>

        <Section title="14. Contact and Data Controller">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-1.5">
            <P><strong className="text-white">Company (Data Controller):</strong> {BUSINESS_NAME}</P>
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
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <span className="text-white/20">·</span>
          <a href={`mailto:${PRIVACY_EMAIL}`} className="hover:text-white transition-colors">{PRIVACY_EMAIL}</a>
          <span className="ml-auto">© {new Date().getFullYear()} {APP_NAME}</span>
        </div>
      </div>
    </div>
  );
}
