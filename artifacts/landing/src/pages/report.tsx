import { useEffect, useState } from "react";
import { Link } from "wouter";

const PLATFORM_META: Record<string, {
  label: string;
  color: string;
  reportUrl: (u: string) => string;
  profileUrl: (u: string) => string;
  icon: string;
}> = {
  instagram: {
    label: "Instagram",
    color: "#E1306C",
    icon: "📸",
    profileUrl: (u) => `https://www.instagram.com/${u}/`,
    reportUrl: () => "https://help.instagram.com/519522125107875",
  },
  facebook: {
    label: "Facebook",
    color: "#1877F2",
    icon: "👤",
    profileUrl: (u) => `https://www.facebook.com/${u}`,
    reportUrl: () => "https://www.facebook.com/help/174210519303259",
  },
  x: {
    label: "X (Twitter)",
    color: "#1DA1F2",
    icon: "✖",
    profileUrl: (u) => `https://x.com/${u}`,
    reportUrl: () => "https://help.twitter.com/en/safety-and-security/report-a-fake-account",
  },
  tiktok: {
    label: "TikTok",
    color: "#69C9D0",
    icon: "🎵",
    profileUrl: (u) => `https://www.tiktok.com/@${u}`,
    reportUrl: () => "https://support.tiktok.com/en/safety-hc/report-a-problem",
  },
  youtube: {
    label: "YouTube",
    color: "#FF0000",
    icon: "▶",
    profileUrl: (u) => `https://www.youtube.com/@${u}`,
    reportUrl: () => "https://support.google.com/youtube/answer/2802268",
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0A66C2",
    icon: "💼",
    profileUrl: (u) => `https://www.linkedin.com/in/${u}`,
    reportUrl: () => "https://www.linkedin.com/help/linkedin/answer/a1340567",
  },
  snapchat: {
    label: "Snapchat",
    color: "#FFFC00",
    icon: "👻",
    profileUrl: (u) => `https://www.snapchat.com/add/${u}`,
    reportUrl: () => "https://support.snapchat.com/en-US/i-need-help",
  },
};

export default function ReportPage() {
  const [platform, setPlatform] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("platform") ?? "";
    const u = params.get("username") ?? "";
    setPlatform(p);
    setUsername(u);

    const handle = u.replace(/^@/, "");
    const platformLabel = PLATFORM_META[p.toLowerCase()]?.label ?? p;
    const title = handle
      ? `Help report @${handle} on ${platformLabel} — Rook Identity Protection`
      : "Help report an impersonator — Rook Identity Protection";
    const description = handle
      ? `Someone is being impersonated by @${handle} on ${platformLabel}. Tap to report the fake account and protect them.`
      : "A Rook user detected a fake account impersonating them. Tap to help report it.";
    const cardImageUrl = "https://getrook.app/landing/opengraph.jpg";
    const canonicalUrl = `https://getrook.app/report?platform=${encodeURIComponent(p)}&username=${encodeURIComponent(handle)}`;

    document.title = title;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const setNameMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("og:title", title);
    setMeta("og:description", description);
    setMeta("og:image", cardImageUrl);
    setMeta("og:url", canonicalUrl);
    setMeta("og:type", "website");
    setMeta("og:site_name", "Rook Identity Protection");
    setNameMeta("twitter:card", "summary_large_image");
    setNameMeta("twitter:title", title);
    setNameMeta("twitter:description", description);
    setNameMeta("twitter:image", cardImageUrl);
    setNameMeta("description", description);
  }, []);

  const handle = username.replace(/^@/, "");
  const meta = PLATFORM_META[platform.toLowerCase()];

  const profileUrl = meta && handle ? meta.profileUrl(handle) : null;
  const reportGuideUrl = meta ? meta.reportUrl(handle) : null;
  const platformLabel = meta?.label ?? platform ?? "this platform";

  return (
    <div className="min-h-screen bg-[#070B12] text-slate-300 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-2 cursor-pointer group">
              <span className="text-xl">🛡️</span>
              <span className="font-bold text-white text-lg tracking-wide">ROOK</span>
            </span>
          </Link>
          <a
            href="https://apps.apple.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            Get the app →
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-lg w-full">

          {/* Alert badge */}
          <div className="flex items-center justify-center mb-8">
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-full px-4 py-2">
              <span className="text-red-400 text-sm">⚠️</span>
              <span className="text-red-400 text-sm font-semibold tracking-wide">Identity Alert</span>
            </div>
          </div>

          {/* Main card */}
          <div className="bg-[#0D1420] border border-white/[0.07] rounded-2xl p-8 mb-6">

            {/* Context */}
            {handle && meta ? (
              <div className="mb-6">
                <div
                  className="inline-flex items-center gap-2 text-sm font-semibold mb-3 px-3 py-1 rounded-lg"
                  style={{ backgroundColor: meta.color + "18", color: meta.color }}
                >
                  <span>{meta.icon}</span>
                  <span>{platformLabel}</span>
                </div>
                <h1 className="text-2xl font-extrabold text-white mb-3 leading-tight">
                  Someone is being impersonated by{" "}
                  <span className="text-blue-400">@{handle}</span>
                  {" "}on {platformLabel}.
                </h1>
                <p className="text-slate-400 leading-relaxed">
                  A Rook user flagged this account as fake and is asking for
                  community help reporting it. Every report counts — platforms take
                  down fake accounts faster when multiple users report them.
                </p>
              </div>
            ) : (
              <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-white mb-3 leading-tight">
                  Someone is being impersonated online.
                </h1>
                <p className="text-slate-400 leading-relaxed">
                  A Rook user detected a fake account impersonating them and is
                  asking for your help reporting it to the platform.
                </p>
              </div>
            )}

            {/* How to help */}
            <div className="bg-[#070B12] rounded-xl p-4 mb-6 border border-white/[0.05]">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                How to help
              </p>
              <ol className="space-y-2.5 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 font-bold mt-0.5">1.</span>
                  <span>
                    {profileUrl ? (
                      <>
                        Open the fake account{" "}
                        <a
                          href={profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
                        >
                          @{handle}
                        </a>{" "}
                        on {platformLabel}
                      </>
                    ) : (
                      <>Search for the fake account on {platformLabel}</>
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 font-bold mt-0.5">2.</span>
                  <span>Tap the ··· menu on their profile and select "Report"</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 font-bold mt-0.5">3.</span>
                  <span>Choose "Fake account" or "Pretending to be someone"</span>
                </li>
              </ol>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col gap-3">
              {profileUrl && (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 h-12 rounded-full text-white font-bold text-sm transition-opacity hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #3B82F6, #7C3AED)",
                  }}
                >
                  <span>🛡️</span>
                  <span>Go to fake account & report</span>
                  <span className="opacity-70">→</span>
                </a>
              )}

              {reportGuideUrl && (
                <a
                  href={reportGuideUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 h-12 rounded-full border border-white/10 text-slate-300 font-medium text-sm hover:bg-white/[0.04] transition-colors"
                >
                  How to report on {platformLabel} →
                </a>
              )}
            </div>
          </div>

          {/* Rook CTA */}
          <div className="bg-[#0D1420] border border-blue-500/20 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">🛡️</div>
            <h2 className="text-white font-bold text-lg mb-2">
              Are you being impersonated?
            </h2>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Rook scans Instagram, TikTok, X, Facebook and more — automatically
              alerting you the moment a fake account is found.
            </p>
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm transition-colors"
            >
              Check if you're being impersonated →
            </a>
            <p className="text-slate-600 text-xs mt-3">Free to start · No credit card needed</p>
          </div>

        </div>
      </main>

      <footer className="text-center py-6 border-t border-white/[0.06]">
        <p className="text-slate-600 text-xs">
          © 2026 Rook · <Link href="/privacy"><span className="hover:text-slate-400 cursor-pointer transition-colors">Privacy</span></Link>
        </p>
      </footer>
    </div>
  );
}
