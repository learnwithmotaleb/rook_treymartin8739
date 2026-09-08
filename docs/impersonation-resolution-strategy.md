# Rook Identity Labs — Impersonation Resolution Strategy
**Product decision memo · Owner: Founding team · Status: Decided · 7 September 2026**

> ## Executive decision — one page
>
> **Decision:** **Launch first. Add a “Verified Resolution Case” (the Resolution Copilot) in V2.** Rook should help a verified person assemble, submit, track, and learn from an impersonation-resolution effort without pretending to be a platform, a law firm, or an enforcement agency.
>
> The V2 product is not “mass reporting” and is not an automated takedown product. It is a structured case record around a user-controlled official report: verified ownership where available; a quality gate on evidence and classification; a guided link-out to the platform’s current official reporting surface; a timeline, reminders, and rechecks; outcome capture; and, for narrowly eligible high-confidence cases, optional human review or partner escalation. The user presses submit on the platform’s site or app. Rook never submits the report, coordinates reporters, promises removal, or represents platform authority.
>
> **Why now is not the moment to build it:** the current build is already in App Review. It already provides the truthful core: detection, evidence, and official report guidance. Threat detail can generate PDF evidence and official report links; threats have resolve actions; and Instagram/Facebook/X ownership can be OAuth-verified to varying degrees. Building persistent cases, a moderation queue, support procedures, new sensitive-data flows, escalation contracts, and revised legal/store materials during review introduces far more rejection, privacy, and operating risk than near-term value. TikTok, YouTube, LinkedIn, and Snapchat are currently discovery-only/coming soon, so a broad “resolution” promise would be premature.
>
> **Immediate action (no code and no change to the active release):** instrument a launch operations spreadsheet or approved analytics export outside the release process to record anonymized/support-derived funnel facts: threat viewed → evidence generated → official link opened → self-reported report submitted → self-reported result. Use a fixed support macro that asks for voluntary outcome feedback and repeats the no-guarantee language. This is measurement, not a new in-app feature and not a report campaign.
>
> **Commercial thesis:** evidence alone is useful but episodic. A trusted, private resolution record makes Rook the system of record for “what happened, what I did, and what changed,” increasing return visits and Premium value without depending on removal guarantees. It also creates the only defensible path to later human service and legitimate platform/partner relationships: high-quality, consented, provenance-backed cases rather than noisy user reports.
>
> **Non-negotiable boundaries:** no auto-submission; no users recruited to report; no public case feed, vote count, report counter, or “boost”; no claim that Rook can remove content; no use of platform data beyond authorized scopes; no storing third-party identifiers unless necessary; and no escalation without qualified human review. Community input, if ever introduced, is private corroboration only, never a vote or call to action.
>
> **Success criterion for V2:** improve the proportion of high-confidence users who complete an official report and obtain a documented outcome, while maintaining zero coordinated-reporting incidents, low false-case/appeal rates, and review-compliant privacy practices. Do not ship merely because a case UI is complete.

---

## 1. Decision context and product truth

Rook’s job is to reduce the time, uncertainty, and evidence loss that make impersonation exhausting. It is **not** to adjudicate speech, determine platform policy, marshal a crowd, or guarantee a takedown. Platforms retain their own reporting, investigation, appeal, and enforcement decisions. Instagram and Facebook each publish their own impersonation-reporting paths; Rook should link users to those current official flows, not substitute for them ([Instagram Help Center](https://help.instagram.com/370054663112398); [Facebook Help Center](https://www.facebook.com/help/174210519303259)). Platform help surfaces, URLs, and required fields can change; they must be reverified before implementation and periodically thereafter.

The architecture makes a staged decision especially clear:

| Current fact | Strategic implication |
|---|---|
| Threat detail already generates PDF evidence and official report links. | The product can truthfully assist action today. A V2 case should organize these existing artifacts, not invent an unproven enforcement capability. |
| Threats support resolve actions. | There is a natural event to seed a future outcome/timeline model. It is not yet durable case management. |
| OAuth account ownership verification exists for Instagram, Facebook, and X, to varying degrees. | “Verified ownership” can be meaningful but must state its scope and fall back to evidence/manual review. It cannot be uniformly promised across networks. |
| TikTok, YouTube, LinkedIn, and Snapchat are coming soon/discovery-only. | Detection can be offered; cross-platform resolution automation or ownership claims cannot. |
| No durable case management or moderation queue exists. | The expensive, safety-critical parts of Resolution Copilot do not exist and should not be rushed through App Review. |
| Analytics is development-only/no-op in production. | Product claims must not rely on inferred funnel data. Establish a deliberate measurement plan before V2. |
| Notifications exist. | V2 can later use consented reminders and rechecks, with frequency controls. |
| Premium gates full evidence. | A case can be a Premium retention driver, but the ability to use official reporting or correct a record must not become a coercive paywall. |
| Database already has threats, connected accounts, identity profiles/verifications, threat actors, and pHash feedback. | There is a credible substrate for a carefully scoped case model, but not a justification to repurpose sensitive data silently. |
| Clerk authentication; legal/consent/deletion/export systems exist. | A sound base exists for identity, consent, retention, and data-subject controls; each new case data category still needs explicit purpose and retention treatment. |

This memo treats “removal outcomes” carefully. A removal is a platform decision, often dependent on facts Rook cannot observe. The product can improve a report’s completeness, evidence preservation, reporting follow-through, and status visibility. It should never claim that a better Rook score causes a takedown.

### The design question

Which concept maximizes useful resolution help and durable differentiation while minimizing platform-policy, App Review, abuse, privacy, and service-delivery risk?

### Launch decision

**LAUNCH FIRST, ADD IN V2.** Freeze the active release scope. Do not insert cases, community, human review, or reporting automation into a build already in App Review.

The reason is not lack of ambition. A proper resolution product creates new obligations:

* storage of report records, screenshots, correspondence, and potentially third-party handles;
* a triage/moderation queue and response standards;
* classification of impersonation versus parody, fan activity, criticism, or legitimate similarly named accounts;
* account-ownership and authorization review;
* appeal/correction handling for people or accounts described in a case;
* revised privacy notice, consent language, terms, deletion/export behavior, and possibly data protection assessment;
* App Store disclosures and reviewer instructions that accurately describe user-controlled reporting; and
* operational training and quality assurance before any human escalation.

None is a cosmetic feature. Adding them now can confuse reviewers under Apple’s rules on user-generated content/moderation, truthful metadata, payments, privacy, and intellectual-property/third-party rights ([App Review Guidelines §§1.2, 2.3, 3.1.2, 5.1.1, 5.1.2, 5.2](https://developer.apple.com/app-store/review/guidelines/)). It can also create noncompliant use of Meta data or misleading representations under the [Meta Platform Terms](https://developers.facebook.com/terms/) and [Developer Policies](https://developers.facebook.com/devpolicy/).

## 2. Product principles and minimum gates

The winning concept is viable only if it starts with constraints, not a growth loop.

### Product principles

1. **User agency, platform authority.** Rook prepares and remembers; the user controls their official report; the platform decides.
2. **Verified when possible, transparent when not.** OAuth evidence of control is displayed as such, with network-specific limitations. It is neither a global identity credential nor proof of rights over every target.
3. **Quality before volume.** A thin report is not made better by sending more people. Case progression rewards complete, provenance-backed evidence and accurate classification.
4. **Private by default.** Cases, artifacts, and corroboration are visible only to the claimant and authorized Rook reviewers/partners on a need-to-know basis. No searchable case directory.
5. **No enforcement theater.** “Submitted to platform,” “under review,” and “removed” are distinct, user-supplied or independently observed states. Do not manufacture certainty.
6. **Least data, shortest useful life.** Store references and provenance before raw content; minimize third-party personal data; apply retention schedules and deletion/export controls.
7. **Human escalation is a privilege, not a button.** It follows eligibility criteria, review, consent, and a valid partner route—not an implied right to platform priority.

### Minimum gates for any case

No case may be created or escalated without all applicable gates below:

| Gate | Requirement |
|---|---|
| Authenticated claimant | Active authenticated Rook user via Clerk; account-risk checks and rate limits. |
| Ownership | OAuth ownership verification where a supported platform exposes it, **or** alternative evidence and/or manual review. State exactly which method was used. |
| Confidence | A high-confidence threat threshold appropriate to the source/model, plus review of contradictory signals. Low-confidence detections remain guidance, not escalation candidates. |
| Classification | Explicit classification of likely impersonation versus parody, fan account, criticism, satire, or ambiguity. Ambiguous/legitimate expression does not enter an escalation path. |
| Attestation | Claimant attests that information is accurate, they are authorized to make the report, and they understand Rook offers no outcome guarantee. |
| Provenance | Evidence records capture source URL, collection time, collector/method, relevant account linkage, hash/version where applicable, and whether user supplied it. |
| Data minimization | Do not store third-party IDs, private contact details, or raw media unless necessary for the case purpose; redact and reference wherever possible. |
| Rate and duplication controls | Rate limits, anomaly checks, and one open case per target per claimant/canonical target prevent pile-ons and duplicate work. |
| Escalation review | A trained human reviews eligibility before any human/partner escalation. |
| Correction | A target appeal/correction process permits challenge, correction, or removal of inaccurate Rook-held information; it is not a platform appeal substitute. |
| No mobilization | No community visibility, report counts, invitation links, “vote,” “confirm,” “boost,” or encouragement to contact/report the target. |

The claimant-facing copy must be plain: “Rook helps you organize evidence and navigate official reporting. We do not submit reports for you, decide whether content violates platform rules, or guarantee removal.”

## 3. Concepts considered before narrowing

The team should not confuse “more action” with “more effect.” The concepts below are serious alternatives, then rejected or redesigned where their incentives are wrong.

### A. Evidence kit and official-report wizard

**Flow.** A signed-in user opens a detection, reviews evidence and classification, confirms account ownership/attestation, receives a concise PDF and a context-specific official platform link, then records whether they reported. The wizard never pre-fills and sends a platform report unless the platform expressly supports such a flow and legal/policy review approves it; default behavior is link-out and user control.

**Effectiveness.** Strong at lowering cognitive friction and preserving facts. It can improve report completeness; it cannot establish that a platform will act. It is the closest continuation of current product behavior and should be the V2 case entry experience.

**Compliance and abuse.** Lowest-risk approach when copy avoids implied affiliation. Meta terms and policies constrain access/use of Meta data and representations; review current permissions, scopes, and policy requirements before each integration ([Terms](https://developers.facebook.com/terms/); [Policies](https://developers.facebook.com/devpolicy/)). Apple risk is manageable with accurate screenshots/metadata and privacy disclosure, but a report feature involving content from others must have clear safety and support paths ([Apple §1.2 and §5.1](https://developer.apple.com/app-store/review/guidelines/)). Abuse controls: attestation, classifier gate, one case per target, and no share-to-report CTA.

**Cost, data, and metrics.** Low-to-medium technical cost; evidence artifact and link telemetry are already conceptually available. Store consent, evidence manifest, external-link version, and user-declared submission/result—not credentials or unnecessary third-party data. Measure eligible-threat-to-evidence completion, official-link opens, voluntary report-completion rate, artifact usefulness, and outcome-response rate. Retention is modest alone because the transaction ends quickly; it becomes durable when wrapped in a case timeline.

**Verdict.** Necessary foundation, not the full strategy.

### B. Persistent resolution case / case manager

**Flow.** An eligible detection becomes a private case. The user verifies ownership, completes an evidence-quality checklist and attestation, is routed to an official reporting link, saves submission details, receives opt-in reminders to recheck, and records platform outcome. A timeline captures evidence, user actions, rechecks, and reviewer decisions. Eligible high-confidence cases may request review.

**Effectiveness.** Better than a one-off kit because reporting is often a process, not a click. It prevents lost evidence, gives users a non-anxious next action, and produces outcome data. It does not increase platform enforcement authority.

**Compliance and abuse.** Moderate risk because persistent allegations/data demand moderation and correction. Design it as private support tooling, not social UGC. Do not show other users’ cases or aggregate accusations. Under the EU Digital Services Act, Articles 16 and 22 impose notice-and-action and trusted-flagger structures on intermediary services in their relevant roles; they do not turn Rook into a platform authority or automatically make Rook a trusted flagger ([DSA](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)). Obtain specialist advice on Rook’s service classification and obligations before EU release.

**Cost, data, and metrics.** Medium build plus real operational cost: case state machine, retention, access control, deletion/export, reviewer console, audit logs, and support playbooks. It has high retention: reminders and rechecks bring users back only while a case remains unresolved, so notifications must be useful and dismissible. Metrics include qualified-case creation, checklist completion, link-out/report completion, median time to user-declared outcome, resolved/closed distribution, recheck completion, correction/appeal rate, and safety incidents.

**Verdict.** Best product shape when constrained by the minimum gates. This is the winner, named **Verified Resolution Case / Resolution Copilot**.

### C. Human-managed takedown assistance

**Flow.** After the same quality gates, a trained specialist reviews a private case, requests clarifications, explains official options, and—only where a legitimate channel and authorization exist—assists with a user-controlled submission or partner escalation. The desk records advice and outcome; it never claims legal representation or platform authority.

**Effectiveness.** Potentially highest per eligible case: humans can catch missing facts and navigate edge cases. The limit is economic: quality service does not scale linearly with a consumer subscription.

**Compliance and abuse.** High operational/legal risk. Specialists need scripts distinguishing factual assistance from legal advice, conflicts and fraud checks, target correction handling, secure evidence practice, quality review, and clear jurisdictional boundaries. Any suggestion that payment buys enforcement priority is dangerous under Apple payment/metadata rules and commercially misleading. Meta relationship claims must be exact and authorized. No “guaranteed takedown” or “priority review” language.

**Cost, data, and metrics.** High cost per case, staffing and training, secure ticketing, QA, and potentially professional-liability review. Store only evidence necessary for review, with role-based access and retention schedules. Track accept rate, handling time, cost per reviewed case, quality defects, claimant satisfaction, documented outcomes, reopens, and escalations that were declined for safety. It is a Premium concierge or B2B add-on, not a launch default.

**Verdict.** Valuable high-touch follow-on, but too expensive and operationally immature for first launch.

### D. Private community corroboration

**Flow.** A user may privately contribute an evidence-bound signal about a case or candidate target after eligibility checks. Signals are not visible to other users, do not trigger platform reports, and do not become a score shown to claimants. They are consumed only by a trained reviewer or anti-abuse model as one input to evidence quality.

**Effectiveness.** May identify repeat patterns or corroborate a detection. It is weak as truth proof: coordinated adversaries, fan disputes, and mistaken identity can create false corroboration.

**Compliance and redesign.** A public or semi-public “confirm/report” experience becomes a coordinated-reporting engine and invites harassment. Redesign it into a **private corroboration signal**: no identity exposure, no target browsing, no notifications to other users, no “count,” no auto-escalation, no rewards tied to outcomes, and no contact/report instructions. Apple §1.2 moderation risk rises sharply with user-generated allegations; privacy risk rises if targets or reporters are identifiable. Use strict eligibility, rate limits, behavioral anomaly detection, and human review.

**Cost, data, and metrics.** High trust-and-safety cost and difficult cold start. Store a minimal, pseudonymous signal with rationale/evidence reference, consent, conflict flags, and audit history—not a public accusation. Measure precision after reviewer disposition, abuse attempts, false-corroboration rate, incremental value over model evidence, and queue burden. Potential network effect is real but dangerous.

**Verdict.** Do not ship broadly. It belongs only in a closed, carefully governed later beta, if at all.

### E. Verified reporter reputation

**Flow.** Rook would score users based on verified ownership, accurate submissions, or outcome history, then prioritize their future cases.

**Effectiveness.** A reputation signal can reduce review burden, but platform outcomes are noisy and a “good reporter” label encourages gaming. It risks creating an unearned impression that a user has platform standing.

**Controls/cost.** If retained internally, use narrow, non-user-visible reliability signals (identity-verification completeness, fraud flags, prior reviewer-quality findings) with appeal and periodic expiry. Never sell, publish, or imply a platform-endorsed reporter rank. This requires model governance, bias review, explanation/correction, and security.

**Verdict.** Internal risk control, not a user-facing product concept or launch feature.

### F. Trusted flagger / partner escalation

**Flow.** Rook submits a limited, human-reviewed evidence package through an actual authorized partner or platform channel where one exists. The claimant consents to the transfer and sees its status without inflated promises.

**Effectiveness.** Strong only with a real contract/channel. The DSA’s trusted-flagger provisions concern qualifying entities and platform handling of their notices; they are not a branding opportunity and do not grant Rook present status ([DSA Article 22](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)).

**Compliance/cost.** Very high. It needs partner due diligence, documented authority, data-sharing agreement, reviewer training, fraud handling, SLAs that do not overpromise, and auditability. Do not use “trusted flagger” unless formally designated in the relevant context.

**Verdict.** A future partnership strategy, not a product assumption.

### G. Privacy-preserving hash consortium

**Flow.** Participating services compare privacy-preserving fingerprints of confirmed harmful media to help prevent re-uploads, subject to exact consent, scope, and partnership rules.

**Effectiveness.** Potentially useful for a narrow, confirmed-media class; poor fit for general impersonation, which often depends on account context, names, and behavior rather than identical imagery. StopNCII illustrates a partnership-dependent, privacy-preserving hash pattern for intimate-image abuse; it is not a general impersonation solution and should not be represented as one ([StopNCII](https://stopncii.org/)).

**Compliance/cost.** Extremely high technical, governance, false-positive, and cross-border data risk. pHash feedback in Rook’s database is a useful research substrate, not permission to construct a consortium. Require independent privacy/security review, participant contracts, deletion propagation, error handling, and platform participation.

**Verdict.** Long-horizon research/partnership option only.

### H. Automated reporting — reject

Auto-submitting forms, using stored sessions/credentials, or simulating users is the wrong product. It destroys user control, amplifies false positives, creates platform terms/policy and security risk, and suggests authority Rook does not possess. It also makes errors scalable. The only acceptable automation is internal preparation: generate an evidence package, open the official path, and remind the user. The user reviews and submits.

### I. Public crowdsourced reporting — reject

Public target pages, votes, “X people reported this,” leaderboards, report-sharing prompts, and referrals to report are prohibited. They invite harassment, retaliation, defamation-like accusations, adversarial brigading, and App Review scrutiny. They are not a defensible network effect. A private corroboration design in section D is the only remotely acceptable redesign, and remains later-stage.

## 4. Top three options and scored decision

### Scoring method

Scores are 1–10, with 10 best. This is a strategic comparison, not a forecast. **Likelihood of improving removal outcomes** is weighted most heavily (20%), but not allowed to dominate: compliance with Meta (15%) and Apple (15%), plus abuse resistance (15%), are hard constraints. UX (8%), technical feasibility (8%), scalability (7%), retention (6%), network effect (3%), and competitive moat (3%) round out commercial value. Any option with a material policy violation is disqualified regardless of weighted score.

| Criterion | Weight | 1. Verified Resolution Case / Resolution Copilot | 2. Human-Assisted Resolution Desk | 3. Private Corroboration Network + partner escalation |
|---|---:|---:|---:|---:|
| Likelihood of improving removal outcomes | 20% | 7 | 9 | 8 |
| Meta compliance | 15% | 9 | 7 | 5 |
| Apple compliance | 15% | 9 | 7 | 4 |
| Abuse resistance | 15% | 8 | 7 | 3 |
| UX | 8% | 9 | 7 | 5 |
| Network-effect potential | 3% | 3 | 2 | 9 |
| Retention potential | 6% | 8 | 7 | 8 |
| Technical feasibility | 8% | 7 | 5 | 3 |
| Scalability | 7% | 8 | 3 | 5 |
| Competitive moat | 3% | 7 | 6 | 9 |
| **Weighted score / 10** | **100%** | **8.0** | **6.9** | **5.0** |

**1. Winner — Verified Resolution Case / Resolution Copilot.** It earns the highest score because it changes user behavior at the point of failure—evidence quality and follow-through—without creating a report-mobilization machine. Its moat is not a proprietary “takedown button”; it is a trusted, consented evidence/provenance and outcome corpus, plus a calm workflow users return to while a situation evolves. That data must never be casually reused for training, advertising, or sharing.

**2. Human-Assisted Resolution Desk.** It can beat software on complex eligible cases, but its economics are unfavorable until Rook has evidence of demand, a carefully limited case mix, trained reviewers, and a pricing model that does not imply pay-to-enforce. Use it selectively after V2 rather than building it as the primary product.

**3. Private Corroboration Network + partner escalation.** This may ultimately be the deepest network moat, especially with legitimate partners, but it combines cold-start, abuse, moderation, and regulatory risk. It is explicitly not launch-ready. Without real partner agreements, “escalation” is just marketing.

## 5. The V2 concept: Verified Resolution Case / Resolution Copilot

### What the user gets

1. **Start from a detected threat.** Rook presents a private “Resolve with Rook” entry only when the threat passes confidence and classification gates. A lower-confidence result remains an investigation/evidence experience.
2. **Verify and attest.** The claimant sees whether ownership is OAuth-verified (and for which account) or needs alternative proof/manual review. They attest to accuracy and authority.
3. **Pass the evidence-quality gate.** Rook explains missing items: canonical target URL, comparison identity/account proof, time-stamped captures, context, and the reason it is likely impersonation rather than parody/fan/criticism. The user can correct or abandon at any point.
4. **Use the official channel.** Rook generates a case-specific PDF evidence package and opens the currently verified official platform reporting path. It tells the user to review the platform form and submit it themselves. It does not submit, scrape a decision, or retain credentials.
5. **Keep a private timeline.** The timeline records evidence created, report link opened, user-declared submission reference (optional/minimized), platform response uploaded or summarized, rechecks, and closure. It clearly labels user-reported versus Rook-observed events.
6. **Receive restrained reminders.** Consent-based reminders ask whether the target is still live or whether the platform responded; frequency is user-controlled and stops at closure.
7. **Capture outcome.** The user selects removed, not removed, no response, account changed, uncertain, or other; optional evidence supports learning. Rook never relabels this as a verified platform decision unless it can substantiate it.
8. **Request eligibility review.** Only high-confidence cases meeting ownership, classification, completeness, and rate-limit criteria can request human review. Approval may result in advice or a formally authorized partner referral—not a guarantee.

### Case states

Conceptual states: `draft`, `awaiting_ownership`, `awaiting_evidence`, `ready_for_user_report`, `official_link_opened`, `user_reported`, `awaiting_recheck`, `review_requested`, `under_human_review`, `escalation_authorized`, `closed_removed`, `closed_not_removed`, `closed_no_response`, `closed_withdrawn`, `corrected_or_appealed`, and `rejected_ineligible`.

Each transition needs actor, timestamp, reason, policy/version, and immutable audit event. “Resolved” must not mean “removed” unless the user selects/proves that result. Existing threat resolve action should remain semantically distinct until a migration defines it.

### What is deliberately absent

* automated or bulk report submission;
* group calls to action, contact lists, social sharing that recruits reporters, reward mechanics, or counters;
* target public profiles, public accusations, feeds, or rankings;
* claim of direct platform authority, legal advice, or a removal SLA;
* broad intake of arbitrary third-party evidence; and
* an opaque “AI says takedown” recommendation.

### Commercial packaging

Keep core safety and truthful official reporting accessible. Premium may reasonably include full evidence export, extended timeline/history, advanced recheck cadence, and concierge eligibility, provided pricing never conditions correction, deletion, or basic access to official reporting. Apple’s in-app purchase rules, particularly §3.1.2, require a current review of the actual digital-service implementation and messaging ([Apple Guidelines](https://developer.apple.com/app-store/review/guidelines/)). Do not market Premium as “guaranteed protection” or “priority platform enforcement.”

## 6. Architecture impact (conceptual; no implementation decision)

This section identifies work that makes V2 real. It does not authorize a code change in the current release.

| Area | Required impact |
|---|---|
| **Auth** | Continue Clerk-based authenticated access. Bind every case to claimant identity; record attestation version; require recent authentication for export, escalation consent, or high-risk changes. Add role separation for reviewer/admin access and auditable impersonation/support access. |
| **Social verification** | Preserve platform-specific OAuth verification evidence, scopes, timestamps, expiry/revocation, and limitations. Do not overstate what a connected account proves. Provide alternative evidence/manual-review path for unsupported networks and discovery-only surfaces. Re-review Meta permissions, terms, and policies before adding any use ([Terms](https://developers.facebook.com/terms/); [Policies](https://developers.facebook.com/devpolicy/)). |
| **Database** | Existing threats, connected accounts, identity profiles/verifications, threat actors, and pHash feedback can be referenced, not duplicated wholesale. Add conceptual `resolution_cases`, `case_evidence_items`, `case_events`, `case_attestations`, `case_outcomes`, `review_decisions`, `appeal_corrections`, `retention_holds`, and `data_access_audit` entities. |
| **APIs** | Create authenticated, idempotent case APIs with strict authorization and canonical-target deduplication. Separate user actions from reviewer actions. Never expose an endpoint that submits a platform report. Apply payload limits, file scanning, rate limits, event audit, pagination, and deletion/export hooks. |
| **Evidence** | Produce a versioned PDF/package manifest: source URL, capture/creation time, source type, hash, relationship to threat, redactions, and collector. Store artifact access controls and expiry. Permit only necessary formats; quarantine uploads; distinguish Rook-generated from user-supplied evidence. |
| **Moderation/admin** | Build a private queue before enabling escalation. Reviewers need classification choices, conflict/abuse flags, evidence completeness, canned neutral explanations, second-review triggers, corrections, and audit logs. No reviewer dashboard that invites volume targets or performance metrics based solely on removals. |
| **Notifications** | Use the existing notification system for explicit opt-in rechecks/reminders. Store purpose, frequency preference, send log, cancellation, and quiet hours. No notification that asks users to report someone. |
| **Analytics** | Production analytics is currently no-op; establish privacy-reviewed, consent-aware event measurement before making V2 claims. Events should measure workflow and safety (not contents): eligibility reached, evidence complete, official-link open, user-declared submission, recheck, outcome, appeal, reviewer decision. Maintain a data dictionary and retention policy. |
| **Legal, privacy, terms** | Update purpose limitation, lawful basis, sensitive-content handling, retention, sharing/partner transfer, automated-assistance disclosure, correction/appeal, and complaint contact. GDPR requires principles including purpose limitation, data minimization, accuracy, storage limitation, integrity/confidentiality, and accountability; assess data-subject rights and any processor/controller roles ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). Existing consent/deletion/export systems must cover all new entities and backups according to stated policy. |
| **Onboarding** | Explain what ownership verification does and does not prove; give examples distinguishing impersonation from parody/fan/criticism; secure affirmative attestation; present no-guarantee language before evidence upload and link-out. |
| **Paywall** | Map each case action to entitlement. Never block safety controls, correction, data rights, or basic official reporting guidance. Test restore purchases and disclosures. |
| **App Store / Meta materials** | Refresh App Review notes, screenshots, privacy nutrition labels, support URLs, descriptions, and reviewer demo instructions. Say “helps organize and navigate official reporting,” not “reports” or “removes.” Verify Meta usage, branding, permissions, and data handling against current policy. |

### Suggested conceptual entity fields

`resolution_case`: opaque ID; claimant ID; threat ID; canonical target reference; platform; state; confidence band/model version; classification and rationale; ownership method/status; attestation version/time; escalation eligibility; retention expiry; created/updated/closed timestamps.

`case_evidence_item`: opaque ID; case ID; type; source URL/reference; provenance method; captured/created time; cryptographic/hash reference; redaction status; storage location/access scope; uploader; integrity/version; deletion status. Avoid target legal names, contact data, and raw media where a URL or derived artifact suffices.

`case_event`: case ID; state/action; actor type and opaque actor ID; timestamp; factual/user-declared/Rook-observed designation; policy/version; immutable audit correlation ID.

`case_outcome`: claimant-selected outcome; date; optional minimally scoped supporting evidence; confidence/source designation; reason for closure; follow-up consent.

`review_decision`: reviewer role/ID; eligibility checks; decision; neutral rationale; second-review flag; partner route if any; expiry; audit reference. `appeal_correction` records the affected party’s request, verification, determination, changes, notification, and deletion/retention decision.

No conceptual schema changes the rule: deletion/export must find every case-associated item, including derived PDFs and logs where legally appropriate; retention holds must be exceptional, documented, and communicated.

## 7. Compliance, safety, and claims discipline

### Meta

Rook must use the current official impersonation routes rather than assert a substitute process ([Instagram](https://help.instagram.com/370054663112398); [Facebook](https://www.facebook.com/help/174210519303259)). The product/legal owner should revalidate every OAuth scope, data use, retention behavior, brand reference, and user-facing claim against the current [Meta Platform Terms](https://developers.facebook.com/terms/) and [Meta Developer Policies](https://developers.facebook.com/devpolicy/) before implementation. Do not infer permission from the existence of connected accounts. Do not state or imply a Meta partnership, privileged reporting route, or enforcement status without written authorization.

### Apple

App Review risk is primarily behavioral and representational: reports about other people can resemble user-generated content requiring safety controls (§1.2); product descriptions/screenshots must accurately represent behavior (§2.3); paid digital features need compliant purchase design (§3.1.2); and personal/third-party data needs appropriate consent, minimization, disclosure, and handling (§§5.1.1–5.1.2). Third-party platform/material rights also matter (§5.2). These are not a checklist exemption; they are reasons to preserve the private, user-controlled, non-mobilizing design ([Apple Guidelines](https://developer.apple.com/app-store/review/guidelines/)).

### GDPR and DSA

Cases can contain identity information, images, handles, allegations, and correspondence. Apply GDPR principles and rights deliberately, including transparent notices, purpose limitation, minimization, accuracy/correction, security, retention, access, portability, and erasure as applicable ([GDPR official text](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). Do not rely on “consent” as a vague blanket for all processing; document the appropriate lawful basis and make withdrawal meaningful where consent is used.

The DSA’s Article 16 notice-and-action and Article 22 trusted-flagger rules primarily describe obligations and procedures for relevant online platforms/intermediary services. They do not make Rook a content host, adjudicator, or trusted flagger by default ([DSA official text](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)). Obtain jurisdiction-specific advice on Rook’s role, particularly if users can upload/share content or Rook transmits notices on their behalf.

### Secondary fraud escalation

When a case includes broader identity fraud, Rook may neutrally point a US user to the FTC’s reporting service as a secondary fraud resource—not as a platform-removal route ([ReportFraud](https://reportfraud.ftc.gov/)). It must not route ordinary platform impersonation there as if it will remove social content.

## 8. Roadmap, stage gates, and KPIs

The sequence below is exact. Advancement is evidence-based, not calendar-based.

### 1. Current Rook Launch

Ship the build currently in App Review unchanged. Maintain truthful detection/evidence/official-report guidance. Train support on neutral no-guarantee language and route serious fraud to appropriate resources without making enforcement claims.

**Stage gate:** App Review outcome and stable core release; no scope insertion.

**KPIs:** threat-detail views, PDF evidence generation, official-link opens where measurable, support contacts tagged “resolution,” and qualitative user comprehension. Because production analytics is no-op today, treat unavailable events as unavailable—not zeros.

### 2. Immediate Post-Launch Measurement

Run the no-code measurement plan: a controlled operations sheet or privacy-approved export, voluntary support follow-up, and a small structured customer interview set. Do not modify the active release. Ask whether the user found the official route, submitted independently, received a response, and what evidence was missing. Do not ask users to report a target and do not collect unnecessary screenshots.

**Stage gate:** enough voluntary, consented observations to identify the top failure points; legal/product sign-off on a measurement data dictionary and retention period.

**KPIs:** evidence-to-link-open conversion; voluntary report-completion rate; response/outcome response rate; median self-reported time to outcome; top abandonment reason; support burden per active user; zero complaints about implied takedown guarantees.

### 3. Feature Prototype

Prototype the private Resolution Copilot with synthetic/test data and internal policy review: eligibility screen, ownership explanation, classification, attestation, evidence checklist, official link-out, timeline, and outcome capture. Test comprehension and failure states. Do not enable partner escalation or community signals.

**Stage gate:** usability participants accurately explain that Rook does not submit reports or guarantee removals; privacy/security design review accepts data map and deletion/export design; abuse review accepts rate/duplicate controls.

**KPIs:** task completion; comprehension of platform authority/no guarantee; false-positive classification challenge rate; evidence completeness; time to prepare a case; prototype data-minimization defects.

### 4. Closed Beta

Enable a small, invite-only cohort of authenticated users on supported platforms. Manual reviewers handle a limited queue under written SOPs. User-controlled link-out, outcome capture, and correction path are live; any human assistance remains advice, not platform escalation. Exclude TikTok, YouTube, LinkedIn, and Snapchat from ownership-dependent claims until support exists.

**Stage gate:** minimum-case quality threshold achieved; reviewer QA and response-time target met; no material abuse/mobilization incident; deletion/export drill succeeds; correction/appeal handling works end-to-end.

**KPIs:** qualified-case rate; official link-out completion; user-declared submission; recheck completion; outcome capture; review acceptance/decline reasons; median handling time; appeal/correction rate; abusive-case rate; notification opt-out; cost per active case.

### 5. Compliance Review

Conduct formal privacy, security, App Store, Meta-policy, and jurisdictional review of the beta’s actual data flows and claims. Recheck platform documentation and UI immediately before release. Review reviewer scripts, partner language, subscription copy, retention, incident response, and data transfer contracts. Determine whether a DPIA or equivalent assessment is warranted.

**Stage gate:** written sign-off from accountable product, legal/privacy, security, and trust-and-safety owners; all critical findings remediated; reviewer and support training complete.

**KPIs:** critical findings open (target: zero); deletion/export test completion; access-control audit pass; misleading-claim findings (target: zero); reviewer agreement on classification; policy-change monitoring cadence established.

### 6. Full Release

Release the V2 Resolution Copilot only for validated platforms and case types. Keep escalation gated, capacity-limited, and human-reviewed. Describe it as resolution organization and official-report guidance, with plain limitations. Expand only after the queue and safety metrics remain healthy.

**Stage gate:** beta performance holds at larger volume without degrading review quality, security, or correction handling.

**KPIs:** eligible user activation; evidence-quality completion; voluntary official-report completion; user-declared documented outcome rate; repeat/recheck retention; Premium conversion attributable to allowed case features; cost per case; safety incidents; correction SLA; zero automated-reporting/coordinated-reporting events.

### 7. Future Platform Partnership Strategy

Pursue formal partnerships only after Rook can show a disciplined case corpus: consented, high-quality, provenance-backed, low-abuse cases and transparent outcomes. Seek clarity on accepted evidence formats, authorized referral channels, and privacy safeguards. Explore a narrow privacy-preserving pattern only with appropriate partners and a use case; StopNCII remains an instructive but non-general model ([StopNCII](https://stopncii.org/)).

**Stage gate:** written partner authorization/data-sharing terms, human-review capacity, user consent transfer flow, and external legal/privacy sign-off. Never announce a partnership based on exploratory conversations.

**KPIs:** authorized referral acceptance; partner feedback on package quality; incremental documented outcome rate versus self-service; partner SLA adherence; data-sharing exceptions; false/abusive escalation rate.

## 9. Risks we accept, risks we do not

We accept that a user may be disappointed when a platform does not act. Honest uncertainty is cheaper than an inflated promise that damages trust and creates regulatory exposure. We accept that some platforms remain discovery-only until ownership/reporting support is defensible. We accept that a private case product will initially have less viral growth than a public crowd feature.

We do **not** accept avoidable false allegations, an unmoderated dossier of third parties, paid “priority enforcement,” a report-mobilization loop, or a fiction that Rook can command platform action. We do not use the DSA label “trusted flagger” unless it is formally applicable. We do not build hashing infrastructure as a shortcut around partnership and governance. We do not let an AI confidence score replace human judgment in ambiguous expression cases.

## 10. Final recommendation

Rook should win by becoming the reliable private workspace between detection and resolution—not by becoming another loud reporting mechanism. **Launch the current product.** Measure actual friction without changing the active release. Then build the **Verified Resolution Case / Resolution Copilot** behind strict verification, evidence, privacy, and human-review gates.

This is commercially credible: it creates a recurring reason to return, a premium-quality artifact, and a basis for selective human service and eventual partners. It is also strategically humble: the person submits; the platform decides; Rook documents and helps. That distinction is not legal fine print. It is the product.

## Sources

Authoritative materials cited above; all should be rechecked before design, integration, App Review submission, or policy claims because platform documentation and user interfaces change.

1. Meta / Instagram, “Report an account that’s impersonating you or someone else”: https://help.instagram.com/370054663112398
2. Meta / Facebook, “How do I report a Facebook account or Page that’s pretending to be me or someone else?”: https://www.facebook.com/help/174210519303259
3. Meta, Platform Terms: https://developers.facebook.com/terms/
4. Meta, Developer Policies: https://developers.facebook.com/devpolicy/
5. Apple, App Review Guidelines (including §§1.2, 2.3, 3.1.2, 5.1.1, 5.1.2, and 5.2): https://developer.apple.com/app-store/review/guidelines/
6. European Union, General Data Protection Regulation, Regulation (EU) 2016/679: https://eur-lex.europa.eu/eli/reg/2016/679/oj
7. European Union, Digital Services Act, Regulation (EU) 2022/2065 (especially Articles 16 and 22): https://eur-lex.europa.eu/eli/reg/2022/2065/oj
8. U.S. Federal Trade Commission, ReportFraud: https://reportfraud.ftc.gov/
9. StopNCII.org: https://stopncii.org/