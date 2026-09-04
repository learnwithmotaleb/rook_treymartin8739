import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Shield, Globe, Bell, Lock, CheckCircle2, Activity, ScanFace,
  Database, Eye, ChevronDown,
  Users, Clock,
} from "lucide-react";
import { WaitlistForm } from "@/components/WaitlistForm";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const STATS = [
  { value: "1", label: "Free identity scan each month", note: "Free plan" },
  { value: "Daily", label: "Automated monitoring available", note: "Premium" },
  { value: "30 days", label: "Threat history retained", note: "Premium" },
  { value: "7 days", label: "Introductory trial for eligible users", note: "Premium" },
];


const FAQS = [
  {
    q: "Why do I need this if I'm not famous?",
    a: "Impersonators don't just target celebrities. Anyone with a social media presence — small business owners, job seekers, parents, professionals — can be targeted. Scammers use real people's identities to run crypto scams, romance fraud, and fake giveaways targeting your existing followers and contacts.",
  },
  {
    q: "How is this different from identity theft protection services?",
    a: "Traditional identity theft services focus on financial fraud — credit monitoring, SSN alerts. Rook focuses on your digital identity: fake social accounts, stolen photos, impersonation scams, and online reputation threats. These are the fastest-growing category of identity crime and almost no existing tool covers them.",
  },
  {
    q: "Which platforms do you monitor?",
    a: "Rook currently supports account connections for Instagram, Facebook, X (Twitter), YouTube, LinkedIn, and Snapchat. TikTok appears in the app but connection support is still coming. You can also add monitored photos and run an identity scan from the app.",
  },
  {
    q: "Will you access my private messages or personal data?",
    a: "Absolutely not. Rook only reads publicly available information — the same information anyone on the internet can see. We never access your DMs, private posts, or any non-public content. Your privacy is our foundation.",
  },
  {
    q: "How quickly will I be notified if a threat is found?",
    a: "Rook Premium runs daily automated scans and can send a push notification when a potential threat is detected. Free members can run one manual scan each month.",
  },
  {
    q: "What happens when Rook finds an impersonator?",
    a: "Rook presents the potential match with a risk assessment and guidance for reviewing and reporting the account. Premium includes full evidence, advanced risk scoring, and downloadable threat reports. Detection is evidence-based, but no automated scan can guarantee it will find every impersonator.",
  },
  {
    q: "Is my data secure?",
    a: "Rook protects data in transit and at rest and does not sell personal information. In the app, you can download your account data, delete stored photo data, withdraw photo-processing consent, or permanently delete your account. See our Privacy Policy for complete details.",
  },
  {
    q: "How much does Rook Premium cost?",
    a: "Rook Premium is $9.99 per month or $69.99 per year. Eligible new subscribers may receive a 7-day introductory trial. Your App Store or Google Play purchase sheet confirms eligibility, localized pricing, and the first charge date. Subscriptions are managed and cancelled through your app store.",
  },
];

function FAQItem({ q, a, isOpen, onClick }: { q: string; a: string; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border border-white/[0.07] rounded-2xl overflow-hidden">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="font-semibold text-base pr-8">{q}</span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <p className="px-6 pb-6 text-muted-foreground text-sm leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Animated Phone Mockup ─────────────────────────────────────────────────── */
function PhoneMockup() {
  const [screen, setScreen] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setScreen((s) => (s + 1) % 3), 4500);
    return () => clearInterval(t);
  }, []);

  // Exact app palette (constants/colors.ts)
  const C = {
    bg: "#070B12",
    card: "#0D1420",
    border: "#1A2740",
    primary: "#3B82F6",
    success: "#10B981",
    danger: "#EF4444",
    warning: "#F59E0B",
    muted: "#6B8EAE",
    text: "#F0F4FF",
    premium: "#7C3AED",
  };

  const sv: Variants = {
    enter: { x: 18, opacity: 0 },
    center: { x: 0, opacity: 1, transition: { duration: 0.32, ease: "easeOut" as const } },
    exit: { x: -18, opacity: 0, transition: { duration: 0.2 } },
  };

  // ── Screen 0: Dashboard ────────────────────────────────────────────────────
  const DashScreen = (
    <motion.div
      key="dash"
      initial="enter"
      animate="center"
      exit="exit"
      variants={sv}
      style={{
        position: "absolute", inset: 0,
        padding: "48px 14px 44px",
        display: "flex", flexDirection: "column", gap: 9, overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: `${C.primary}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={C.primary}><path d="M12 2L3.5 6.5v5c0 5.25 3.58 10.15 8.5 11.5 4.92-1.35 8.5-6.25 8.5-11.5v-5L12 2z" /></svg>
          </div>
          <span style={{ color: C.text, fontSize: 11, fontWeight: 700, letterSpacing: -0.3 }}>Rook</span>
        </div>
        <div style={{ position: "relative" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          <div style={{ position: "absolute", top: -5, right: -5, width: 13, height: 13, borderRadius: 7, background: C.danger, border: `1.5px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontSize: 7, fontWeight: 800 }}>1</span>
          </div>
        </div>
      </div>

      {/* Score Ring */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <svg width="92" height="92" viewBox="0 0 92 92" style={{ filter: "drop-shadow(0 0 14px rgba(59,130,246,0.35))" }}>
          <defs>
            <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <circle cx="46" cy="46" r="37" fill="none" stroke={C.border} strokeWidth="6" />
          <motion.circle
            cx="46" cy="46" r="37" fill="none" stroke="url(#rg)" strokeWidth="6"
            strokeLinecap="round" transform="rotate(-90 46 46)"
            initial={{ strokeDasharray: "0 232.5" }}
            animate={{ strokeDasharray: `${0.72 * 232.5} 232.5` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
          <text x="46" y="43" textAnchor="middle" fill={C.text} fontSize="18" fontWeight="700" fontFamily="system-ui,-apple-system">72</text>
          <text x="46" y="55" textAnchor="middle" fill={C.muted} fontSize="8.5" fontFamily="system-ui">SCORE</text>
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: 7, height: 7, borderRadius: 4, background: C.success }}
          />
          <span style={{ color: C.success, fontSize: 9, fontWeight: 600 }}>Protected · Facebook monitored</span>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
        {[
          { label: "Monitored", value: "5", hi: false },
          { label: "Alerts", value: "1", hi: true },
          { label: "Resolved", value: "2", hi: false },
        ].map((s, i) => (
          <div key={i} style={{
            background: s.hi ? `${C.danger}12` : C.card,
            border: `1px solid ${s.hi ? C.danger + "40" : C.border}`,
            borderRadius: 10, padding: "7px 4px", textAlign: "center",
          }}>
            <div style={{ color: s.hi ? C.danger : C.text, fontSize: 13, fontWeight: 700 }}>{s.value}</div>
            <div style={{ color: C.muted, fontSize: 7.5, marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Section label */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: C.text, fontSize: 10, fontWeight: 600 }}>Recent Threats</span>
        <span style={{ color: C.primary, fontSize: 9 }}>View all →</span>
      </div>

      {/* Alert row – pulses */}
      <motion.div
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2.5, repeat: Infinity }}
        style={{ background: `${C.danger}0D`, border: `1px solid ${C.danger}38`, borderRadius: 12, padding: "9px 10px", display: "flex", alignItems: "center", gap: 8 }}
      >
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C.danger}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.danger, fontSize: 10, fontWeight: 600 }}>Impersonator Detected</div>
          <div style={{ color: C.muted, fontSize: 8, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@alex_official_backup · Facebook</div>
        </div>
        <span style={{ color: C.muted, fontSize: 8, flexShrink: 0 }}>2m</span>
      </motion.div>

      {/* Clean row */}
      <div style={{ background: `${C.success}0A`, border: `1px solid ${C.success}28`, borderRadius: 12, padding: "9px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C.success}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <div style={{ color: C.success, fontSize: 10, fontWeight: 600 }}>All Clear</div>
          <div style={{ color: C.muted, fontSize: 8, marginTop: 2 }}>No impersonators detected</div>
        </div>
      </div>
    </motion.div>
  );

  // ── Screen 1: Alerts ───────────────────────────────────────────────────────
  const AlertsScreen = (
    <motion.div
      key="alerts"
      initial="enter"
      animate="center"
      exit="exit"
      variants={sv}
      style={{ position: "absolute", inset: 0, padding: "48px 14px 44px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Alerts</span>
        <div style={{ background: `${C.danger}1A`, border: `1px solid ${C.danger}40`, borderRadius: 10, padding: "2px 9px" }}>
          <span style={{ color: C.danger, fontSize: 9.5, fontWeight: 700 }}>3 active</span>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 5 }}>
        {(["All", "High", "Medium", "Low"] as const).map((f, i) => (
          <div key={i} style={{ background: i === 0 ? C.primary : C.card, border: `1px solid ${i === 0 ? C.primary : C.border}`, borderRadius: 8, padding: "3px 9px" }}>
            <span style={{ color: i === 0 ? "white" : C.muted, fontSize: 9, fontWeight: 600 }}>{f}</span>
          </div>
        ))}
      </div>

      {/* Threat rows */}
      {[
        { sev: "HIGH", label: "Impersonator Detected", sub: "@alex_official_backup · Facebook", time: "2m", color: C.danger },
        { sev: "MED", label: "Stolen Photo Found", sub: "@fake_backup_2024 · Instagram", time: "18m", color: C.warning },
        { sev: "LOW", label: "Username Variant Found", sub: "@yourname_official · LinkedIn", time: "1h", color: C.success },
      ].map((a, i) => (
        <div key={i} style={{ background: `${a.color}0C`, border: `1px solid ${a.color}28`, borderRadius: 12, padding: "9px 10px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: a.color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.text, fontSize: 10, fontWeight: 600 }}>{a.label}</div>
            <div style={{ color: C.muted, fontSize: 8, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.sub}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
            <span style={{ color: C.muted, fontSize: 7.5 }}>{a.time}</span>
            <div style={{ background: `${a.color}22`, borderRadius: 5, padding: "1px 5px" }}>
              <span style={{ color: a.color, fontSize: 7, fontWeight: 800 }}>{a.sev}</span>
            </div>
          </div>
        </div>
      ))}

      {/* Upgrade lock */}
      <div style={{ background: `${C.premium}10`, border: `1px solid ${C.premium}2E`, borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 9, marginTop: 2 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C.premium}1E`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <div>
          <div style={{ color: "#A78BFA", fontSize: 10, fontWeight: 600 }}>+2 threats hidden</div>
          <div style={{ color: C.muted, fontSize: 8, marginTop: 1 }}>Upgrade to Premium to see all alerts</div>
        </div>
      </div>
    </motion.div>
  );

  // ── Screen 2: Threat Detail ────────────────────────────────────────────────
  const DetailScreen = (
    <motion.div
      key="detail"
      initial="enter"
      animate="center"
      exit="exit"
      variants={sv}
      style={{ position: "absolute", inset: 0, padding: "48px 14px 44px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>
        <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>Threat Detail</span>
        <div style={{ marginLeft: "auto", background: `${C.danger}18`, border: `1px solid ${C.danger}40`, borderRadius: 8, padding: "2px 8px" }}>
          <span style={{ color: C.danger, fontSize: 8.5, fontWeight: 800 }}>HIGH RISK</span>
        </div>
      </div>

      {/* Platform card */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "white", fontSize: 9, fontWeight: 900 }}>f</span>
        </div>
        <div>
          <div style={{ color: C.text, fontSize: 10, fontWeight: 600 }}>Facebook Impersonator</div>
          <div style={{ color: C.muted, fontSize: 8, marginTop: 1 }}>@alex_official_backup · Found 2m ago</div>
        </div>
      </div>

      {/* Threat score gauge */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "9px 11px", display: "flex", alignItems: "center", gap: 11 }}>
        <svg width="58" height="58" viewBox="0 0 58 58" style={{ flexShrink: 0 }}>
          <circle cx="29" cy="29" r="22" fill={`${C.danger}10`} stroke={`${C.danger}28`} strokeWidth="5" />
          <motion.circle
            cx="29" cy="29" r="22" fill="none" stroke={C.danger} strokeWidth="5"
            strokeLinecap="round" transform="rotate(-90 29 29)"
            initial={{ strokeDasharray: "0 138.2" }}
            animate={{ strokeDasharray: `${0.87 * 138.2} 138.2` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          />
          <text x="29" y="26" textAnchor="middle" fill={C.danger} fontSize="13" fontWeight="800" fontFamily="system-ui,-apple-system">87</text>
          <text x="29" y="36" textAnchor="middle" fill={C.muted} fontSize="7" fontFamily="system-ui">/100</text>
        </svg>
        <div>
          <div style={{ color: C.danger, fontSize: 12, fontWeight: 700 }}>High Risk</div>
          <div style={{ color: C.muted, fontSize: 8, marginTop: 3, lineHeight: 1.5 }}>Threat score 87/100<br />4 media matches detected</div>
        </div>
      </div>

      {/* AI Analysis */}
      <div style={{ background: `${C.primary}09`, border: `1px solid ${C.primary}22`, borderRadius: 10, padding: "9px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14Z"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14Z"/>
          </svg>
          <span style={{ color: C.primary, fontSize: 9, fontWeight: 700 }}>AI ANALYSIS</span>
        </div>
        <p style={{ color: C.muted, fontSize: 8.5, lineHeight: 1.5, margin: 0 }}>
          @alex_official_backup shows critical impersonation signals — 4 of your media assets were reused. Account created 3 weeks after your verified profile. Immediate reporting recommended.
        </p>
      </div>

      {/* Detected signals */}
      <div>
        <div style={{ color: C.muted, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, marginBottom: 6 }}>DETECTED SIGNALS</div>
        {[
          "Visual media similarity: 32/40 match score",
          "Username follows known impersonation pattern",
          "Account created after your verified profile",
        ].map((sig, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: `${C.danger}18`, border: `1px solid ${C.danger}38`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={C.danger} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <span style={{ color: C.muted, fontSize: 8, lineHeight: 1.4 }}>{sig}</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: "auto" }}>
        <div style={{ background: C.danger, borderRadius: 10, padding: "9px 0", color: "white", fontSize: 10, fontWeight: 700, textAlign: "center" }}>
          Report Guide
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 0", color: C.text, fontSize: 10, fontWeight: 600, textAlign: "center" }}>
          Mark Resolved
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="relative flex justify-center items-center py-8"
    >
      <div className="absolute w-56 h-56 bg-primary/20 rounded-full blur-[80px] opacity-60 pointer-events-none" />

      {/* Phone shell */}
      <div
        className="relative w-[240px] h-[490px] rounded-[44px] border border-white/[0.12] overflow-hidden z-10 shadow-[0_40px_80px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04),0_0_60px_rgba(59,130,246,0.15)]"
        style={{ background: C.bg }}
      >
        {/* Dynamic island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-30" />

        <AnimatePresence mode="wait">
          {screen === 0 && DashScreen}
          {screen === 1 && AlertsScreen}
          {screen === 2 && DetailScreen}
        </AnimatePresence>

        {/* Screen-progress dots */}
        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-30">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => setScreen(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === screen ? "w-4 bg-primary" : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Context badges that change with screen */}
      <AnimatePresence>
        {screen === 0 && (
          <motion.div
            key="b0"
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.35 }}
            className="absolute -right-5 top-28 glass-panel px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-medium z-20 shadow-lg whitespace-nowrap"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Threat detected
          </motion.div>
        )}
        {screen === 1 && (
          <motion.div
            key="b1"
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.35 }}
            className="absolute -left-7 top-28 glass-panel px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-medium z-20 shadow-lg whitespace-nowrap"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            3 active alerts
          </motion.div>
        )}
        {screen === 2 && (
          <motion.div
            key="b2"
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.35 }}
            className="absolute -right-5 bottom-40 glass-panel px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-medium z-20 shadow-lg whitespace-nowrap"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            AI analysis ready
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */
export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  const scrollToWaitlist = () => {
    const heroForm = document.getElementById("hero-form");
    const ctaForm = document.getElementById("cta-form");
    const heroTop = heroForm?.getBoundingClientRect().top ?? Infinity;
    const ctaTop = ctaForm?.getBoundingClientRect().top ?? Infinity;
    const target =
      Math.abs(heroTop) <= Math.abs(ctaTop) ? heroForm : ctaForm;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    const handleScroll = () => setShowStickyBar(window.scrollY > 600);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <img src="/landing/logo.png" alt="Rook" className="h-14 w-14 object-contain" />
            <span className="text-white tracking-tight">ROOK</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <button
            onClick={scrollToWaitlist}
            className="text-sm font-semibold px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors"
          >
            Get Early Access
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-primary/15 rounded-full blur-[140px] opacity-40 pointer-events-none" />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="flex flex-col gap-7 relative z-10"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold w-fit">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
              </span>
              Instagram, Facebook, X &amp; more · TikTok connection coming later
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.05]">
              Someone may be{" "}
              <span className="text-gradient-primary">impersonating you</span>{" "}
              right now.
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              Fake profiles and stolen photos can put your reputation and your community at risk before you know they exist.
              <span className="text-white font-medium"> Rook uses identity signals, photo matching, and AI-assisted analysis to surface potential impersonation threats and help you respond.</span>
            </motion.p>

            <motion.div variants={fadeUp} id="hero-form" className="w-full max-w-md">
              <WaitlistForm buttonText="Protect My Identity" placeholder="Your email address" />
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Free to start · No credit card
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-400" /> Cancel through your app store
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  App Store
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                    <path d="M3.18 23.76a2 2 0 0 0 2.18-.43l.06-.06 12.23-7.07-2.66-2.67M1.5 1.87A2 2 0 0 0 1 3.28v17.44a2 2 0 0 0 .5 1.41l.07.07 9.77-9.77v-.23L1.5 1.87m20.25 8.36-2.62-1.52-2.93 2.93 2.93 2.93 2.65-1.52a2 2 0 0 0 0-3.82M3.18.24L15.41 7.3l-2.66 2.67L.44.44A2 2 0 0 1 3.18.24z" />
                  </svg>
                  Google Play
                </div>
                <span className="text-xs text-muted-foreground">— Join the waitlist above for early access when we launch</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Animated phone mockup */}
          <PhoneMockup />
        </div>
      </section>

      {/* ── Statistics Strip ──────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center justify-center gap-1"
              >
                <span className="font-extrabold text-3xl text-white tracking-tight">{s.value}</span>
                <span className="text-xs text-muted-foreground font-medium leading-tight max-w-[140px]">{s.label}</span>
                <span className="text-[10px] text-white/20 font-medium uppercase tracking-wider mt-0.5">{s.note}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution / Outcomes ───────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold mb-6">
              <Shield className="w-3.5 h-3.5" />
              Finally — a solution
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              See when Rook finds a potential{" "}
              <span className="text-gradient-primary">identity is threatened.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground leading-relaxed">
              Rook scans public identity signals and your monitored photos for suspicious matches, then brings the evidence and reporting guidance together in one place.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-2xl" />
            <div className="relative glass-panel rounded-3xl p-8 flex flex-col gap-6 border border-white/[0.07]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg">Example Threat Monitor</span>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  Illustrative preview
                </div>
              </div>
              {[
                { platform: "Instagram", status: "2 username variants scanned", time: "2m ago", type: "clean" },
                { platform: "Instagram", status: "Potential impersonator detected", time: "11m ago", type: "threat" },
                { platform: "X (Twitter)", status: "Profile photo match found", time: "34m ago", type: "threat" },
                { platform: "Facebook", status: "No matching profiles found", time: "1h ago", type: "clean" },
                { platform: "LinkedIn", status: "Public profile signals reviewed", time: "2h ago", type: "clean" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-4"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${item.type === "threat" ? "bg-red-400" : "bg-green-400"}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold">{item.platform}</span>
                    <span className="text-sm text-muted-foreground"> — {item.status}</span>
                  </div>
                  <span className="text-xs text-white/25 shrink-0">{item.time}</span>
                </motion.div>
              ))}
              <div className="pt-4 border-t border-white/[0.07]">
                <button onClick={scrollToWaitlist} className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold transition-colors text-sm">
                  Start Monitoring My Identity
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 relative bg-white/[0.01] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Serious identity protection. Built for individuals.
            </h2>
            <p className="text-muted-foreground">Practical monitoring, evidence, and privacy controls for creators, professionals, families, and anyone with an online identity.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <ScanFace className="w-5 h-5 text-primary" />, title: "Evidence-Based Detection", desc: "Rook compares public profile signals, names, handles, and available photos to surface likely impersonation matches for your review." },
              { icon: <Eye className="w-5 h-5 text-primary" />, title: "Photo Monitoring", desc: "Add photos to your identity profile so Rook can look for suspicious visual matches across supported public sources." },
              { icon: <Database className="w-5 h-5 text-primary" />, title: "Threat Analysis", desc: "Potential threats include a risk score, detected signals, and available evidence. Premium unlocks full evidence and downloadable reports." },
              { icon: <Activity className="w-5 h-5 text-primary" />, title: "Daily Premium Monitoring", desc: "Rook Premium includes automated daily scans, unlimited manual scans, and priority processing. Free includes one manual scan each month." },
              { icon: <Bell className="w-5 h-5 text-primary" />, title: "Threat Alerts", desc: "Review potential threats in one alert feed. Premium can send push notifications and provides reporting guidance with full evidence." },
              { icon: <Globe className="w-5 h-5 text-primary" />, title: "Connected Identity", desc: "Connect supported Instagram, Facebook, X, YouTube, LinkedIn, and Snapchat accounts from one app. TikTok connection is coming later." },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="glass-panel p-6 rounded-2xl hover:bg-white/[0.04] transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 px-6 bg-white/[0.01] border-b border-white/5">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-4">Designed for a clear first scan</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">Three steps to start monitoring.</h2>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-10 left-[18%] right-[18%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            {[
              { step: 1, title: "Build Your Identity Profile", desc: "Connect supported social accounts and add the photos you want Rook to monitor." },
              { step: 2, title: "Run an Identity Scan", desc: "Rook checks public sources for suspicious names, handles, profile signals, and available photo matches." },
              { step: 3, title: "Review and Respond", desc: "Evaluate potential matches, inspect available evidence, and follow platform-specific reporting guidance." },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative z-10 flex flex-col items-center"
              >
                <div className="w-20 h-20 rounded-full bg-background border border-border/80 flex items-center justify-center shadow-xl mb-6 relative">
                  <div className="absolute inset-2 rounded-full border border-primary/30 flex items-center justify-center bg-primary/5">
                    <span className="text-xl font-extrabold text-primary">{item.step}</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-muted-foreground text-sm max-w-[260px] leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-16 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-4">Simple, transparent pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Your digital identity <span className="text-gradient-primary">is worth protecting.</span></h2>
            <p className="text-muted-foreground text-lg">Start free, then choose monthly or annual Premium in the app.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="glass-panel p-8 rounded-3xl flex flex-col">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Free</h3>
              <div className="text-4xl font-extrabold mb-1">$0</div>
              <div className="text-sm text-muted-foreground mb-8">Free forever</div>
              <ul className="flex flex-col gap-4 mb-8 flex-1">
                {["1 connected account", "1 manual scan per month", "1 monitored image per scan", "Basic scan results"].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={scrollToWaitlist} className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors font-semibold text-sm">
                Start Free
              </button>
            </div>

            <div className="glass-panel p-8 rounded-3xl flex flex-col border-primary/40 relative transform md:-translate-y-4 shadow-[0_0_50px_rgba(59,130,246,0.12)] bg-card/80">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Rook Premium</h3>
              <div className="text-4xl font-extrabold mb-1">$9.99</div>
              <div className="text-sm text-primary/70 mb-2 font-medium">per month</div>
              <div className="text-sm text-muted-foreground mb-8">$69.99/year · about $5.83/month · save 42%</div>
              <ul className="flex flex-col gap-4 mb-8 flex-1">
                {["Unlimited accounts, scans, and monitored images", "Daily automated monitoring", "Push alerts + full evidence", "30-day threat history", "Advanced risk scoring + downloadable reports"].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={scrollToWaitlist} className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white transition-colors font-bold shadow-lg shadow-primary/20 text-sm">
                Get Premium Early Access
              </button>
              <p className="text-[11px] text-muted-foreground text-center leading-relaxed mt-4">
                7-day introductory trial for eligible new subscribers. Your app store confirms eligibility and localized pricing. Cancel through the App Store or Google Play.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 relative overflow-hidden border-t border-white/5">
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none">
          <div className="w-[800px] h-[800px] border border-primary rounded-full absolute animate-[ping_5s_cubic-bezier(0,0,0.2,1)_infinite]" />
          <div className="w-[600px] h-[600px] border border-primary rounded-full absolute animate-[ping_5s_cubic-bezier(0,0,0.2,1)_infinite_1s]" />
          <div className="w-[400px] h-[400px] border border-primary rounded-full absolute animate-[ping_5s_cubic-bezier(0,0,0.2,1)_infinite_2s]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl mx-auto text-center relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-8">
            <Users className="w-3.5 h-3.5" />
            Built for people who take their online identity seriously
          </div>
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-6 leading-tight">
            The next impersonation attempt{" "}
            <span className="text-gradient-primary">won't wait.</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
            Free to start. Join the waitlist and be among the first to monitor your identity with Rook.
          </p>
          <div id="cta-form">
            <WaitlistForm className="max-w-md mx-auto" buttonText="Protect My Identity" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Free to start</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Guided setup</span>
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-primary" /> App-store billing</span>
          </div>
        </motion.div>
      </section>

      {/* ── FAQ (after final CTA) ─────────────────────────────────────────────── */}
      <section id="faq" className="py-16 px-6 bg-white/[0.01] border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-4">Got questions</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Everything you need to know.</h2>
          </div>

          <div className="flex flex-col gap-3">
            {FAQS.map((faq, i) => (
              <FAQItem
                key={i}
                q={faq.q}
                a={faq.a}
                isOpen={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-10">
            Still have questions?{" "}
            <a href="mailto:support@tryrook.app" className="text-primary hover:underline">Contact us</a>
          </p>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-lg">
            <img src="/landing/logo.png" alt="Rook" className="h-14 w-14 object-contain" />
            <span className="text-white tracking-tight">ROOK</span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground font-medium justify-center">
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="mailto:support@tryrook.app" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-sm text-muted-foreground text-right">
            <div>© {new Date().getFullYear()} Rook Identity Labs LLC. All rights reserved.</div>
            <div className="mt-0.5">
              <a href="tel:+18328193114" className="hover:text-white transition-colors">+1 (832) 819-3114</a>
              {" · "}
              <a href="mailto:support@tryrook.app" className="hover:text-white transition-colors">support@tryrook.app</a>
            </div>
            <div className="text-xs mt-0.5 text-white/30">127 N Higgins Ave Suite 307D #2992, Missoula, MT 59802</div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/[0.04]">
          <p className="text-xs text-white/20 text-center leading-relaxed max-w-3xl mx-auto">
            Rook monitors publicly available information only. Statistics sourced from FTC Consumer Sentinel, Meta Transparency Reports, and IBM Security X-Force. Rook is not affiliated with any social media platform.
          </p>
        </div>
      </footer>

      {/* ── Mobile Sticky CTA ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden p-4 glass-panel border-t border-white/10 shadow-2xl"
          >
            <button
              onClick={scrollToWaitlist}
              className="w-full py-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-base transition-colors shadow-lg shadow-primary/25"
            >
              Protect My Identity — Free
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
