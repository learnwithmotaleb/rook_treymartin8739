import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Shield, Globe, Bell, Lock, Zap, CheckCircle2, Activity, ScanFace,
  Database, Eye, ChevronDown, AlertTriangle, Cpu, Bot, Brain,
  Users, Clock, TrendingUp, X as XIcon,
} from "lucide-react";
import { WaitlistForm } from "@/components/WaitlistForm";
import { AnimatedRing } from "@/components/AnimatedRing";
import { ThreatCard } from "@/components/ThreatCard";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const STATS = [
  { value: "$10B+", label: "Lost to social media fraud in 2023", source: "FTC" },
  { value: "5.4B", label: "Fake accounts removed annually", source: "Meta" },
  { value: "197 days", label: "Average time to discover a breach", source: "IBM" },
  { value: "1 in 10", label: "Adults targeted by impersonation", source: "FTC" },
];

const THREATS_HAPPENING_NOW = [
  "Someone is copying your profile photo to create a fake account right now.",
  "A clone account may already be messaging your followers asking for money.",
  "Your username variants are being registered while you read this.",
  "Someone is using your face and name to sell products you've never endorsed.",
  "Fake posts attributed to you are circulating on platforms you've never used.",
];

const WHY_NOW = [
  {
    icon: <Brain className="w-5 h-5 text-primary" />,
    title: "AI-Generated Fake Profiles",
    desc: "Anyone can create a convincing clone of your identity in under 60 seconds using freely available AI tools. Realistic photos. Believable bios. Your name.",
  },
  {
    icon: <Cpu className="w-5 h-5 text-primary" />,
    title: "Deepfake Technology",
    desc: "AI-generated videos and voice clones make impersonation indistinguishable from the real thing — and accessible to anyone with a laptop.",
  },
  {
    icon: <Bot className="w-5 h-5 text-primary" />,
    title: "Bot Account Factories",
    desc: "Automated systems create thousands of fake accounts per hour — each one tailored to impersonate real people at scale.",
  },
  {
    icon: <Globe className="w-5 h-5 text-primary" />,
    title: "Your Identity is Public Data",
    desc: "Your photos, posts, bio, and personal details are publicly available across seven platforms. That's everything a scammer needs.",
  },
];

const OUTCOMES = [
  "Know the moment someone creates a profile using your name or photo.",
  "Know when your images appear on platforms you've never used.",
  "Know when fake accounts message your followers or contacts.",
  "Know when your personal data surfaces in a breach.",
  "Take action in seconds — with one-click reporting and auto-takedown.",
];

const FAQS = [
  {
    q: "Why do I need this if I'm not famous?",
    a: "Impersonators don't just target celebrities. Anyone with a social media presence — small business owners, job seekers, parents, professionals — can be targeted. Scammers use real people's identities to run crypto scams, romance fraud, and fake giveaways targeting your existing followers and contacts.",
  },
  {
    q: "How is this different from identity theft protection services?",
    a: "Traditional identity theft services focus on financial fraud — credit monitoring, SSN alerts. ShieldID focuses on your digital identity: fake social accounts, stolen photos, impersonation scams, and online reputation threats. These are the fastest-growing category of identity crime and almost no existing tool covers them.",
  },
  {
    q: "Which platforms do you monitor?",
    a: "ShieldID actively monitors Instagram, Facebook, X (Twitter), TikTok, YouTube, LinkedIn, and Snapchat — with more platforms being added. Our AI scans across all of them simultaneously so you don't have to check each one manually.",
  },
  {
    q: "Will you access my private messages or personal data?",
    a: "Absolutely not. ShieldID only reads publicly available information — the same information anyone on the internet can see. We never access your DMs, private posts, or any non-public content. Your privacy is our foundation.",
  },
  {
    q: "How quickly will I be notified if a threat is found?",
    a: "ShieldID runs continuous scans and delivers push notifications directly to your phone the moment a potential threat is detected. You'll know within minutes — not months.",
  },
  {
    q: "What happens when ShieldID finds an impersonator?",
    a: "You'll receive an instant alert with full details on the fake account. From there, you can view the impersonator's profile, auto-generate a DMCA takedown request, and report them directly to the platform with a single tap. ShieldID handles the paperwork.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted in transit and at rest. We never sell your personal information. You can delete your account and all associated data at any time from the app. We comply with GDPR and CCPA.",
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

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  const scrollToWaitlist = () => {
    document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyBar(window.scrollY > 600);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">

      {/* ── Sticky Nav ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <img src="/landing/logo.png" alt="ShieldID" className="h-11 w-11 object-contain" />
            <span>Shield<span className="text-primary">ID</span></span>
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

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
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
              Identity threats detected across 7 platforms daily
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.05]">
              Someone may be{" "}
              <span className="text-gradient-primary">impersonating you</span>{" "}
              right now.
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              1 in 10 people are being impersonated online. Most don't find out until their reputation is already damaged, their followers are scammed, and the fake account has thousands of followers.
              <span className="text-white font-medium"> ShieldID finds them first.</span>
            </motion.p>

            <motion.div variants={fadeUp} id="hero-form" className="w-full max-w-md">
              <WaitlistForm buttonText="Protect My Identity" placeholder="Your email address" />
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Free to start · No credit card
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-400" /> Cancel anytime
                </p>
              </div>

              {/* App store badges */}
              <div className="flex flex-wrap items-center gap-3 mt-5">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm font-medium text-white/50 select-none">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  App Store
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm font-medium text-white/50 select-none">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                    <path d="M3.18 23.76a2 2 0 0 0 2.18-.43l.06-.06 12.23-7.07-2.66-2.67M1.5 1.87A2 2 0 0 0 1 3.28v17.44a2 2 0 0 0 .5 1.41l.07.07 9.77-9.77v-.23L1.5 1.87m20.25 8.36-2.62-1.52-2.93 2.93 2.93 2.93 2.65-1.52a2 2 0 0 0 0-3.82M3.18.24L15.41 7.3l-2.66 2.67L.44.44A2 2 0 0 1 3.18.24z" />
                  </svg>
                  Google Play
                </div>
                <span className="text-xs text-muted-foreground">· Coming Soon</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex justify-center items-center py-8"
          >
            <div className="absolute w-72 h-72 bg-primary/20 rounded-full blur-[90px] opacity-60 pointer-events-none" />
            <div className="relative w-[268px] h-[548px] bg-[#07070f] rounded-[44px] border border-white/[0.11] shadow-[0_40px_80px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.04),0_0_50px_rgba(59,130,246,0.12)] overflow-hidden z-10">
              <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-20 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-800" />
                <div className="w-1 h-1 rounded-full bg-gray-700" />
              </div>
              <div className="absolute inset-0 flex flex-col pt-14 pb-4 px-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Shield className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-white text-xs font-bold tracking-tight">ShieldID</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 text-[10px] font-semibold">Protected</span>
                  </div>
                </div>
                <div className="flex justify-center" style={{ transform: "scale(0.54)", transformOrigin: "center top", height: "150px", marginBottom: "-38px" }}>
                  <AnimatedRing score={72} />
                </div>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {[
                    { label: "Accounts", value: "7", hi: false },
                    { label: "Alerts", value: "1", hi: true },
                    { label: "Score", value: "72", hi: false },
                  ].map((s, i) => (
                    <div key={i} className={`rounded-xl p-2 text-center border ${s.hi ? "bg-red-500/10 border-red-500/20" : "bg-white/[0.04] border-white/[0.06]"}`}>
                      <div className={`font-bold text-xs ${s.hi ? "text-red-400" : "text-white"}`}>{s.value}</div>
                      <div className="text-[9px] text-white/40 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                <motion.div
                  animate={{ opacity: [0.75, 1, 0.75] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  className="bg-red-500/[0.07] border border-red-500/20 rounded-2xl p-3 flex items-center gap-2.5 mb-2"
                >
                  <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-red-400 text-[10px] font-semibold">Impersonator Found</div>
                    <div className="text-white/45 text-[9px] truncate">@●●●●_official · Instagram</div>
                  </div>
                  <span className="text-[9px] text-white/25 shrink-0">2m</span>
                </motion.div>
                <div className="bg-green-500/[0.06] border border-green-500/15 rounded-2xl p-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div>
                    <div className="text-green-400 text-[10px] font-semibold">Email Secure</div>
                    <div className="text-white/45 text-[9px]">No breach records found</div>
                  </div>
                </div>
              </div>
            </div>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1, duration: 0.5 }} className="absolute -right-4 top-24 glass-panel px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-medium z-20 shadow-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Threat blocked
            </motion.div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.4, duration: 0.5 }} className="absolute -left-4 bottom-32 glass-panel px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-medium z-20 shadow-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Identity verified
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Statistics Strip ────────────────────────────────────────────────── */}
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
                <span className="text-[10px] text-white/20 font-medium uppercase tracking-wider mt-0.5">Source: {s.source}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem Awareness ──────────────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-6">
              <AlertTriangle className="w-3.5 h-3.5" />
              Most people don't know they're at risk
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              Your digital identity is being{" "}
              <span className="text-gradient-primary">exploited right now.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Most people don't discover impersonation until a friend sends them a screenshot — or until the damage is already done. By then, fake accounts have hundreds of followers, scammed real people, and destroyed reputations that took years to build.
            </motion.p>
          </motion.div>

          <div className="flex flex-col gap-4 mb-12">
            {THREATS_HAPPENING_NOW.map((threat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex items-start gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-red-500/20 hover:bg-red-500/[0.03] transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-red-500/20 transition-colors">
                  <XIcon className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-base text-foreground/80 leading-relaxed">{threat}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center p-8 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.07]"
          >
            <p className="text-2xl font-bold mb-2">Most people only find out when it's too late.</p>
            <p className="text-muted-foreground mb-6">The average victim discovers impersonation after 197 days. ShieldID detects it in minutes.</p>
            <button
              onClick={scrollToWaitlist}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold transition-colors"
            >
              Find Out If You're Already a Target
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Why Now ─────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-black relative border-y border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] opacity-30 pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
              <TrendingUp className="w-3.5 h-3.5" />
              This problem doubles every year
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              AI has made identity theft{" "}
              <span className="text-gradient-primary">effortless.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The same technology that powers creativity is being weaponized to steal identities at a scale that was impossible just two years ago. This is not a future problem. It's happening now.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHY_NOW.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="glass-panel p-6 rounded-2xl flex flex-col gap-4 hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  {item.icon}
                </div>
                <h3 className="font-bold text-base">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution / Outcomes ─────────────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
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
              Know the moment your{" "}
              <span className="text-gradient-primary">identity is threatened.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground mb-10 leading-relaxed">
              ShieldID watches every corner of the internet so you don't have to. The moment something goes wrong, you're the first to know — with everything you need to stop it instantly.
            </motion.p>

            <motion.div variants={stagger} className="flex flex-col gap-4">
              {OUTCOMES.map((outcome, i) => (
                <motion.div key={i} variants={fadeUp} className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <p className="text-base font-medium">{outcome}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.p variants={fadeUp} className="mt-8 text-sm text-muted-foreground italic">
              "Finding out 4 months later isn't protection. It's damage control."
            </motion.p>
          </motion.div>

          {/* Live stats visual */}
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
                <span className="font-bold text-lg">Live Threat Monitor</span>
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Active
                </div>
              </div>
              {[
                { platform: "Instagram", status: "2 username variants scanned", time: "2m ago", type: "clean" },
                { platform: "TikTok", status: "Impersonator detected + reported", time: "11m ago", type: "threat" },
                { platform: "X (Twitter)", status: "Profile photo match found", time: "34m ago", type: "threat" },
                { platform: "Facebook", status: "No matching profiles found", time: "1h ago", type: "clean" },
                { platform: "LinkedIn", status: "Name variant monitoring active", time: "2h ago", type: "clean" },
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

      {/* ── Features Grid ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 relative bg-white/[0.01] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Enterprise-grade protection. Built for everyone.
            </h2>
            <p className="text-muted-foreground">The tools usually reserved for celebrities and Fortune 500 companies — now available to any creator, professional, or individual.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <ScanFace className="w-5 h-5 text-primary" />,
                title: "AI Impersonator Detection",
                desc: "Our neural net scans profile photos, bios, and handles across 7 platforms to find clones before they can scam your followers.",
              },
              {
                icon: <Eye className="w-5 h-5 text-primary" />,
                title: "Stolen Photo Monitoring",
                desc: "We track where your images appear across the web and social platforms — surfacing every unauthorized use of your face.",
              },
              {
                icon: <Database className="w-5 h-5 text-primary" />,
                title: "Data Breach Alerts",
                desc: "Get notified the moment your email, passwords, or personal info surfaces in a new security breach — before hackers can exploit it.",
              },
              {
                icon: <Activity className="w-5 h-5 text-primary" />,
                title: "Live Security Score",
                desc: "A continuously-updated health metric of your digital footprint, with prioritized action steps to strengthen your protection.",
              },
              {
                icon: <Bell className="w-5 h-5 text-primary" />,
                title: "Instant Threat Alerts",
                desc: "One centralized alert feed. Review, dismiss, or auto-report threats in seconds — directly from your phone.",
              },
              {
                icon: <Globe className="w-5 h-5 text-primary" />,
                title: "7-Platform Coverage",
                desc: "Monitor Instagram, Facebook, X, TikTok, YouTube, LinkedIn, and Snapchat simultaneously from one unified dashboard.",
              },
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

      {/* ── Live Threat Demo ───────────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-black relative border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]" />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10 flex flex-col gap-4">
            <ThreatCard platform="Instagram" severity="High" type="Impersonator Detected" username="@●●●●_official_backup" timeAgo="2m ago" delay={0.1} />
            <div className="ml-8">
              <ThreatCard platform="TikTok" severity="Medium" type="Stolen Photo Upload" username="@●●●●_fans_page" timeAgo="18m ago" delay={0.3} />
            </div>
            <ThreatCard platform="X" severity="High" type="Phishing Link in Bio" username="@●●●●_support_team" timeAgo="1h ago" delay={0.5} />
          </div>

          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              See threats the moment they appear.
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              ShieldID doesn't wait for your followers to report a fake account. Our AI actively hunts for clones, intercepts impersonators, and gives you everything you need to shut them down — before any damage is done.
            </p>
            <ul className="flex flex-col gap-4 mb-8">
              {[
                "Auto-generate DMCA takedown requests in seconds",
                "1-click reporting directly to platform trust & safety",
                "Push notifications the moment a threat is detected",
                "Full evidence package for each impersonator found",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <button onClick={scrollToWaitlist} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold transition-colors">
              Get Early Access
            </button>
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────────── */}
      <section className="py-28 px-6 relative border-b border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-4">Real stories · Real impact</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              They wish they'd known sooner.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "Someone cloned my Instagram and started messaging my followers asking for crypto investments. ShieldID caught the fake account within 10 minutes of it going live. It had already messaged 4 people. Without ShieldID, it could have been hundreds.",
                name: "Sarah Jenkins",
                handle: "@sarahj_creates",
                role: "Content Creator · 48K followers",
                initials: "SJ",
              },
              {
                quote: "My photos were being used to catfish people on three different dating apps. I had no idea for months. ShieldID found all three profiles in its first scan and helped me file takedown requests the same day. This is genuinely life-changing.",
                name: "Marcus Thorne",
                handle: "@marcust_fitness",
                role: "Fitness Coach · 120K followers",
                initials: "MT",
              },
              {
                quote: "As a consultant, my professional reputation is everything. An old breach had exposed my credentials and someone was using them to impersonate me on LinkedIn. ShieldID found it before any of my clients did. I can't put a price on that.",
                name: "Elena Rostova",
                handle: "@elenaconsults",
                role: "Independent Consultant",
                initials: "ER",
              },
            ].map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="glass-panel p-7 rounded-2xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex gap-1 mb-5 text-yellow-400">
                    {[...Array(5)].map((_, j) => (
                      <svg key={j} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm text-foreground/85 leading-relaxed mb-6">"{t.quote}"</p>
                </div>
                <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/[0.06]">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary border border-primary/20">
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.handle} · {t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 px-6 bg-white/[0.01] border-b border-white/5">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-4">Setup takes 2 minutes</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-20">Three steps to complete protection.</h2>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-10 left-[18%] right-[18%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            {[
              { step: 1, title: "Connect Your Accounts", desc: "Link your social profiles in under 2 minutes to establish your verified digital identity baseline." },
              { step: 2, title: "AI Scanning Begins", desc: "ShieldID immediately begins scanning 7 platforms for impersonators, stolen photos, and identity threats." },
              { step: 3, title: "Get Instant Alerts", desc: "Receive push notifications the moment a threat is detected, with everything you need to act immediately." },
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

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-4">Simple, transparent pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Protect your identity. Start free.</h2>
            <p className="text-muted-foreground text-lg">Lock in launch pricing today. Cancel anytime. No questions asked.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free */}
            <div className="glass-panel p-8 rounded-3xl flex flex-col">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Basic Shield</h3>
              <div className="text-4xl font-extrabold mb-1">$0</div>
              <div className="text-sm text-muted-foreground mb-8">Free forever</div>
              <ul className="flex flex-col gap-4 mb-8 flex-1">
                {["1 connected account", "Basic impersonation alerts", "Weekly security digest", "Standard support"].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={scrollToWaitlist} className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors font-semibold text-sm">
                Start Free
              </button>
            </div>

            {/* Pro */}
            <div className="glass-panel p-8 rounded-3xl flex flex-col border-primary/40 relative transform md:-translate-y-4 shadow-[0_0_50px_rgba(59,130,246,0.12)] bg-card/80">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Pro Shield</h3>
              <div className="text-4xl font-extrabold mb-1">$7.99</div>
              <div className="text-sm text-primary/70 mb-8 font-medium">per month · 7-day free trial</div>
              <ul className="flex flex-col gap-4 mb-8 flex-1">
                {["3 connected accounts", "AI-powered scanning", "Stolen photo detection", "Dark web monitoring", "Priority support"].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={scrollToWaitlist} className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white transition-colors font-bold shadow-lg shadow-primary/20 text-sm">
                Reserve My Spot
              </button>
            </div>

            {/* Premium */}
            <div className="glass-panel p-8 rounded-3xl flex flex-col">
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Premium Shield</h3>
              <div className="text-4xl font-extrabold mb-1">$14.99</div>
              <div className="text-sm text-muted-foreground mb-8">per month · 7-day free trial</div>
              <ul className="flex flex-col gap-4 mb-8 flex-1">
                {["Unlimited accounts", "Instant SMS alerts", "Auto-takedown requests", "Dedicated account manager", "API access"].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-purple-400/60 shrink-0 mt-0.5" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>
              <button onClick={scrollToWaitlist} className="w-full py-3 rounded-xl border border-purple-500/30 hover:bg-purple-500/10 text-purple-300 transition-colors font-semibold text-sm">
                Claim Early Access
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-28 px-6 bg-white/[0.01] border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
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
            <a href="mailto:support@shieldid.app" className="text-primary hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="py-36 px-6 relative overflow-hidden border-t border-white/5">
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
            Join thousands of people already protecting their identity
          </div>
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-6 leading-tight">
            Your digital identity{" "}
            <span className="text-gradient-primary">is worth protecting.</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
            Free to start. Takes 2 minutes. The next impersonation attempt won't wait — and neither should you.
          </p>
          <WaitlistForm className="max-w-md mx-auto" buttonText="Protect My Identity" />
          <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Free to start</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Setup in 2 minutes</span>
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-primary" /> Cancel anytime</span>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-lg">
            <img src="/landing/logo.png" alt="ShieldID" className="h-10 w-10 object-contain" />
            <span>Shield<span className="text-primary">ID</span></span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground font-medium justify-center">
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="/api/legal/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="/api/legal/terms" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="mailto:support@shieldid.app" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ShieldID. All rights reserved.
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/[0.04]">
          <p className="text-xs text-white/20 text-center leading-relaxed max-w-3xl mx-auto">
            ShieldID monitors publicly available information only. Statistics sourced from FTC Consumer Sentinel, Meta Transparency Reports, and IBM Security X-Force. ShieldID is not affiliated with any social media platform.
          </p>
        </div>
      </footer>

      {/* ── Mobile Sticky CTA ──────────────────────────────────────────────── */}
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
