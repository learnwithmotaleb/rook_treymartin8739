import { motion, type Variants } from "framer-motion";
import { Shield, Globe, Bell, Lock, Zap, CheckCircle2, Activity, ScanFace, Database, Fingerprint, Eye } from "lucide-react";
import { WaitlistForm } from "@/components/WaitlistForm";
import { AnimatedRing } from "@/components/AnimatedRing";
import { ThreatCard } from "@/components/ThreatCard";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } }
};

export default function Home() {
  const scrollToWaitlist = () => {
    document.getElementById("waitlist-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
      
      {/* Sticky Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <img src="/landing/logo.png" alt="ShieldID" className="h-11 w-11 object-contain" />
            <span>Shield<span className="text-primary">ID</span></span>
          </div>
          <button 
            onClick={scrollToWaitlist}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
          >
            Join Waitlist
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-30 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="flex flex-col gap-8 relative z-10"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium w-fit">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Watching 7 Platforms 24/7
            </motion.div>
            
            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.1]">
              Stop impersonators <br/>
              <span className="text-gradient-primary">before they strike.</span>
            </motion.h1>
            
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              The first AI-powered identity shield for creators and professionals. 
              We detect clones, alert you to stolen photos, and protect your digital reputation.
            </motion.p>
            
            <motion.div variants={fadeUp} id="waitlist-form" className="w-full max-w-md mt-4">
              <WaitlistForm />
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> No credit card required to join.
              </p>
            </motion.div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex justify-center items-center h-full min-h-[400px]"
          >
            <div className="relative z-10">
              <AnimatedRing score={72} />
              
              {/* Floating badges */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-4 -right-12 glass-panel px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
              >
                <div className="w-2 h-2 rounded-full bg-red-500" />
                1 Threat Blocked
              </motion.div>
              
              <motion.div 
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-8 -left-8 glass-panel px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium border-green-500/20"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Network Secure
              </motion.div>
            </div>
            
            {/* Radar rings background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <div className="w-64 h-64 border border-primary rounded-full" />
              <div className="absolute w-96 h-96 border border-primary rounded-full" />
              <div className="absolute w-[32rem] h-[32rem] border border-primary rounded-full opacity-50" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof Strip */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-white/5">
            <div className="flex flex-col items-center justify-center gap-2">
              <Globe className="w-6 h-6 text-primary mb-1" />
              <span className="font-bold text-2xl text-white">7</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Platforms Monitored</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-2">
              <ScanFace className="w-6 h-6 text-primary mb-1" />
              <span className="font-bold text-2xl text-white">24/7</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">AI Detection</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-2">
              <Zap className="w-6 h-6 text-primary mb-1" />
              <span className="font-bold text-2xl text-white">Real-time</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Instant Alerts</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-2">
              <Shield className="w-6 h-6 text-primary mb-1" />
              <span className="font-bold text-2xl text-white">100%</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Privacy Focus</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">An intelligence agency for your reputation.</h2>
            <p className="text-muted-foreground">We built the tools usually reserved for enterprise security teams, and made them available to everyone.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <ScanFace className="w-5 h-5 text-primary" />,
                title: "AI Impersonator Detection",
                desc: "Our neural net scans profile pictures, bios, and handles to find clones before they can scam your followers."
              },
              {
                icon: <Eye className="w-5 h-5 text-primary" />,
                title: "Stolen Photo Monitoring",
                desc: "Upload your face and we'll track where your images appear across the dark web and social platforms."
              },
              {
                icon: <Database className="w-5 h-5 text-primary" />,
                title: "Data Breach Alerts",
                desc: "Get notified instantly if your email, passwords, or personal info appears in a new security breach."
              },
              {
                icon: <Activity className="w-5 h-5 text-primary" />,
                title: "Live Security Score",
                desc: "A real-time health metric of your digital footprint, with actionable steps to improve your defense."
              },
              {
                icon: <Bell className="w-5 h-5 text-primary" />,
                title: "Real-Time Threat Feed",
                desc: "One centralized dashboard for all alerts. Review, dismiss, or auto-report threats in seconds."
              },
              {
                icon: <Globe className="w-5 h-5 text-primary" />,
                title: "Multi-Platform Coverage",
                desc: "Monitor Instagram, Facebook, X, TikTok, YouTube, LinkedIn, and Snapchat from one unified dashboard."
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
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

      {/* Live Threat Intel Demo */}
      <section className="py-24 px-6 bg-black relative border-y border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
        
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10 flex flex-col gap-4">
            <ThreatCard 
              platform="Instagram"
              severity="High"
              type="Impersonator Detected"
              username="@●●●●_official_backup"
              timeAgo="2m ago"
              delay={0.1}
            />
            <div className="ml-8">
              <ThreatCard 
                platform="TikTok"
                severity="Medium"
                type="Stolen Content Upload"
                username="@●●●●_fans"
                timeAgo="15m ago"
                delay={0.3}
              />
            </div>
            <ThreatCard 
              platform="X"
              severity="High"
              type="Phishing Link in Bio"
              username="@●●●●_support"
              timeAgo="1h ago"
              delay={0.5}
            />
          </div>
          
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">See threats the moment they appear.</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Our AI doesn't wait for your followers to report a fake account. We actively hunt for clones trying to scam your community, intercepting them before they cause damage.
            </p>
            <ul className="flex flex-col gap-4">
              {['Auto-generate DMCA takedown requests', '1-click reporting to platform trust & safety', 'Block lists updated dynamically'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-16">Three steps to total security.</h2>
          
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-px bg-border/50" />
            
            {[
              { step: 1, title: "Connect Accounts", desc: "Link your profiles to establish your verified digital footprint." },
              { step: 2, title: "AI Scanning Starts", desc: "Our engine indexes the platforms and builds your threat model." },
              { step: 3, title: "Get Instant Alerts", desc: "Receive push notifications the second an anomaly is detected." }
            ].map((item, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-background border border-border flex items-center justify-center shadow-xl mb-6 relative">
                  <div className="absolute inset-2 rounded-full border border-primary/20 flex items-center justify-center bg-card">
                    <span className="text-xl font-bold text-primary">{item.step}</span>
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm max-w-[250px]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Defend your identity.</h2>
            <p className="text-muted-foreground text-lg">Lock in launch pricing today. Cancel anytime.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <div className="glass-panel p-8 rounded-3xl flex flex-col">
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">Basic Shield</h3>
              <div className="text-4xl font-bold mb-6">$0<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
              <ul className="flex flex-col gap-4 mb-8 flex-1">
                {['1 Connected Account', 'Basic impersonation alerts', 'Weekly security digest', 'Standard support'].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <button onClick={scrollToWaitlist} className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors font-medium">Join Waitlist</button>
            </div>

            {/* Pro Tier */}
            <div className="glass-panel p-8 rounded-3xl flex flex-col border-primary/50 relative transform md:-translate-y-4 shadow-[0_0_40px_rgba(59,130,246,0.15)] bg-card/80">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-lg font-semibold text-primary mb-2">Pro Shield</h3>
              <div className="text-4xl font-bold mb-2">$7.99<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
              <p className="text-xs text-primary/80 mb-6 font-medium">Launch price. Normally $14.99</p>
              
              <ul className="flex flex-col gap-4 mb-8 flex-1">
                {['3 Connected Accounts', 'Real-time AI scanning', 'Stolen photo detection', 'Dark web monitoring', 'Priority email support'].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-medium">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button onClick={scrollToWaitlist} className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white transition-colors font-semibold shadow-lg shadow-primary/25">Join Waitlist</button>
            </div>

            {/* Premium Tier */}
            <div className="glass-panel p-8 rounded-3xl flex flex-col">
              <h3 className="text-lg font-semibold text-purple-400 mb-2">Premium Shield</h3>
              <div className="text-4xl font-bold mb-6">$14.99<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
              <ul className="flex flex-col gap-4 mb-8 flex-1">
                {['Unlimited Accounts', 'Instant SMS alerts', 'Auto-takedown requests', 'Dedicated account manager', 'API access'].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-purple-400/70 shrink-0" />
                    <span className="text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>
              <button onClick={scrollToWaitlist} className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors font-medium">Join Waitlist</button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 bg-black relative border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Don't wait until it happens.</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "Someone cloned my Instagram and started messaging my followers asking for crypto. ShieldID caught it within 10 minutes. Absolute lifesaver.",
                name: "Sarah Jenkins",
                handle: "@sarahj_creates",
                initials: "SJ"
              },
              {
                quote: "I found out my photos were being used on dating apps through the stolen photo monitor. The auto-takedown feature is worth the Pro tier alone.",
                name: "Marcus Thorne",
                handle: "@marcust_fitness",
                initials: "MT"
              },
              {
                quote: "As a consultant, my reputation is everything. Getting a notification that my old password was in a breach let me secure my accounts immediately.",
                name: "Elena Rostova",
                handle: "@elenaconsults",
                initials: "ER"
              }
            ].map((t, i) => (
              <div key={i} className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
                <div className="flex gap-1 mb-4 text-yellow-500">
                  {[...Array(5)].map((_, j) => <svg key={j} className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3 mt-auto">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-xs text-muted-foreground border border-border">
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-primary">{t.handle}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 relative overflow-hidden">
        {/* Radar animation background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <div className="w-[800px] h-[800px] border border-primary rounded-full absolute animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]" />
          <div className="w-[600px] h-[600px] border border-primary rounded-full absolute animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite_1s]" />
          <div className="w-[400px] h-[400px] border border-primary rounded-full absolute animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite_2s]" />
        </div>
        
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Secure your digital life.</h2>
          <p className="text-xl text-muted-foreground mb-10">
            Join the waitlist today. Get early access and lock in lifetime launch pricing.
          </p>
          <WaitlistForm className="max-w-md mx-auto" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-lg">
            <img src="/landing/logo.png" alt="ShieldID" className="h-10 w-10 object-contain" />
            <span>Shield<span className="text-primary">ID</span></span>
          </div>
          
          <div className="flex gap-8 text-base text-muted-foreground font-medium">
            <a href="/api/legal/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="/api/legal/terms" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="mailto:support@shieldid.app" className="hover:text-white transition-colors">Contact</a>
          </div>
          
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ShieldID. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}