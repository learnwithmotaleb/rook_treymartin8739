
import React from "react";

const BRAND = {
  navy: "#0B1220",
  card: "#131C2E",
  blue: "#3B82F6",
  blueLight: "#60A5FA",
  blueFaint: "#DBEAFE",
  white: "#FFFFFF",
};

/**
 * The Rook mark — shield frame + face profile silhouette.
 *
 * Construction (3 layers, painter order):
 *   1. Shield FRAME  – stroke-only, no fill; the dark interior is visible through it.
 *   2. Face PROFILE  – solid white/gradient fill; overlaps the shield's right edge.
 *      Includes the inner surface (nose, lips, throat) so the face reads clearly.
 *      The nose protrudes LEFT into the shield's dark interior → creates the "R" bowl.
 *
 * viewBox 0 0 200 200.
 * Shield occupies x 38–110, y 42–178.
 * Face occupies  x 110–168, y 28–178.
 */
function RookMarkSVG({
  gradId,
  bgColor = BRAND.navy,         // null = transparent bg
  markStartColor = "#FFFFFF",
  markEndColor = BRAND.blue,
  rounded = true,
  size = 200,
}: {
  gradId: string;
  bgColor?: string | null;
  markStartColor?: string;
  markEndColor?: string;
  rounded?: boolean;
  size?: number;
}) {
  const rx = rounded ? (44 / 200) * size : 0;
  const gGlow = `${gradId}-glow`;
  const gMark = `${gradId}-mark`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Blue ambient glow behind the mark */}
        <radialGradient id={gGlow} cx="46%" cy="43%" r="52%">
          <stop offset="0%"   stopColor={BRAND.blue} stopOpacity="0.42" />
          <stop offset="100%" stopColor={BRAND.blue} stopOpacity="0"    />
        </radialGradient>
        {/* Mark gradient: white top-left → blue bottom-right */}
        <linearGradient id={gMark} x1="38" y1="28" x2="155" y2="178" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={markStartColor} />
          <stop offset="55%"  stopColor={markStartColor === "#FFFFFF" ? "#C7DDFF" : markStartColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={markEndColor}   />
        </linearGradient>
      </defs>

      {/* Background */}
      {bgColor && <rect width="200" height="200" rx={rx} fill={bgColor} />}
      {bgColor && <rect width="200" height="200" rx={rx} fill={`url(#${gGlow})`} />}

      {/* ─── LAYER 1 · Shield frame (stroke, no fill) ─── */}
      {/*
          Classic shield: flat top, straight sides, rounded-point bottom.
          The dark background is visible through the open interior.
          strokeLinejoin="round" gives clean corners.
      */}
      <path
        fill="none"
        stroke={`url(#${gMark})`}
        strokeWidth="11"
        strokeLinejoin="round"
        d="
          M 42,44
          L 42,44
          L 110,44
          L 110,116
          Q 110,158 76,177
          Q 38,158 38,116
          L 38,44
          Z
        "
      />

      {/* ─── LAYER 2 · Face profile (solid fill) ─── */}
      {/*
          Left-facing profile: nose points LEFT into the shield's dark interior.
          Inner surface (throat → lips → nose → bridge → brow) is included so
          the face reads as a recognisable profile and the R-shaped space is clear.
          Starts / ends at the shield's top-right corner (110, 44).
      */}
      <path
        fill={`url(#${gMark})`}
        d="
          M 110,44
          Q 126,30 146,28
          Q 166,34 168,66
          L 167,108
          Q 164,132 152,139
          L 152,162
          Q 144,177 127,178
          Q 110,178 108,166
          L 109,140
          Q 102,128 94,118
          Q 78,112 66,104
          Q 76,92 92,82
          Q 110,66 110,48
          Z
        "
      />
    </svg>
  );
}

/* ── Transparent background checker ── */
function Checker({ size }: { size: number }) {
  const c = 10;
  return (
    <svg width={size} height={size} style={{ position: "absolute", inset: 0, borderRadius: 8 }}>
      <defs>
        <pattern id="ck" width={c * 2} height={c * 2} patternUnits="userSpaceOnUse">
          <rect width={c} height={c} fill="#d0d0d0" />
          <rect x={c} width={c} height={c} fill="#f8f8f8" />
          <rect y={c} width={c} height={c} fill="#f8f8f8" />
          <rect x={c} y={c} width={c} height={c} fill="#d0d0d0" />
        </pattern>
      </defs>
      <rect width={size} height={size} fill="url(#ck)" rx="8" />
    </svg>
  );
}

/* ── Small helpers ── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748B", fontFamily: "Inter,sans-serif", textAlign: "center", letterSpacing: "0.05em", textTransform: "uppercase" }}>
      {children}
    </p>
  );
}
function Row({ children, gap = 28 }: { children: React.ReactNode; gap?: number }) {
  return <div style={{ display: "flex", alignItems: "flex-end", gap, flexWrap: "wrap" }}>{children}</div>;
}
function Tile({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {children}
      <Label>{label}</Label>
    </div>
  );
}
function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 18px", fontSize: 10, fontWeight: 700, color: "#334155", fontFamily: "Inter,sans-serif", textTransform: "uppercase", letterSpacing: "0.14em" }}>
      {children}
    </p>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 44 }}>
      <SectionHead>{title}</SectionHead>
      {children}
    </div>
  );
}

/* ─────────────────────────── MAIN PREVIEW ─────────────────────────── */
export default function RookLogoPreview() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A1120",
      padding: "44px 52px 60px",
      fontFamily: "Inter,sans-serif",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 44 }}>
        <p style={{ margin: 0, fontSize: 21, fontWeight: 700, color: "#F1F5F9", letterSpacing: "-0.02em" }}>
          Rook — Improved Logo
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#475569" }}>
          Shield frame + identity profile · brand colours applied · pending your approval before replacing anywhere
        </p>
      </div>

      {/* ─── 1. App icon sizes ─── */}
      <Section title="App icon">
        <Row gap={28}>
          <Tile label="1024 px">
            <RookMarkSVG size={136} gradId="s1a" />
          </Tile>
          <Tile label="180 px">
            <RookMarkSVG size={96} gradId="s1b" />
          </Tile>
          <Tile label="60 px">
            <RookMarkSVG size={62} gradId="s1c" />
          </Tile>
          <Tile label="40 px">
            <RookMarkSVG size={44} gradId="s1d" />
          </Tile>
          <Tile label="20 px">
            <RookMarkSVG size={24} gradId="s1e" />
          </Tile>
        </Row>
      </Section>

      {/* ─── 2. Wordmarks ─── */}
      <Section title="Wordmark">
        <Row gap={24}>
          {/* Dark nav bar */}
          <Tile label="Nav / header (dark)">
            <div style={{
              background: "rgba(11,18,32,0.95)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10,
              padding: "10px 20px",
              display: "flex", alignItems: "center", gap: 9,
            }}>
              <RookMarkSVG size={36} gradId="wm1" bgColor={null} rounded={false} />
              <span style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", letterSpacing: "0.1em" }}>ROOK</span>
            </div>
          </Tile>

          {/* Auth screen */}
          <Tile label="Auth screen">
            <div style={{
              background: "#0D1728",
              border: "1px solid #1A2842",
              borderRadius: 16,
              padding: "24px 32px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              minWidth: 150,
            }}>
              <RookMarkSVG size={68} gradId="wm2" />
              <span style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9", letterSpacing: "0.14em" }}>ROOK</span>
              <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.04em" }}>IDENTITY PROTECTION</span>
            </div>
          </Tile>

          {/* Landing page light bg */}
          <Tile label="Landing page (light bg)">
            <div style={{
              background: "#F1F5F9",
              border: "1px solid #E2E8F0",
              borderRadius: 10,
              padding: "10px 20px",
              display: "flex", alignItems: "center", gap: 9,
            }}>
              <RookMarkSVG
                size={36}
                gradId="wm3"
                bgColor={null}
                rounded={false}
                markStartColor={BRAND.blue}
                markEndColor="#1D4ED8"
              />
              <span style={{ fontSize: 18, fontWeight: 700, color: BRAND.blue, letterSpacing: "0.1em" }}>ROOK</span>
            </div>
          </Tile>
        </Row>
      </Section>

      {/* ─── 3. Transparent variants ─── */}
      <Section title="Mark only — transparent background">
        <Row gap={24}>
          <Tile label="White (dark bgs)">
            <div style={{ position: "relative", width: 90, height: 90 }}>
              <Checker size={90} />
              <div style={{ position: "absolute", inset: 0 }}>
                <RookMarkSVG size={90} gradId="tp1" bgColor={null} rounded={false}
                  markStartColor="#FFFFFF" markEndColor="#FFFFFF" />
              </div>
            </div>
          </Tile>
          <Tile label="Blue gradient">
            <div style={{ position: "relative", width: 90, height: 90 }}>
              <Checker size={90} />
              <div style={{ position: "absolute", inset: 0 }}>
                <RookMarkSVG size={90} gradId="tp2" bgColor={null} rounded={false}
                  markStartColor="#60A5FA" markEndColor="#1D4ED8" />
              </div>
            </div>
          </Tile>
          <Tile label="Navy (light bg)">
            <div style={{ position: "relative", width: 90, height: 90 }}>
              <Checker size={90} />
              <div style={{ position: "absolute", inset: 0 }}>
                <RookMarkSVG size={90} gradId="tp3" bgColor={null} rounded={false}
                  markStartColor={BRAND.navy} markEndColor="#1e3a5f" />
              </div>
            </div>
          </Tile>
        </Row>
      </Section>

      {/* ─── 4. Favicon / notification icon ─── */}
      <Section title="Favicon / notification icon">
        <Row gap={20} style={{ alignItems: "flex-end" }}>
          {([64, 32, 16] as const).map(s => (
            <Tile key={s} label={`${s} px`}>
              <div style={{ background: "#fff", borderRadius: 4, padding: 3, display: "inline-flex" }}>
                <RookMarkSVG size={s} gradId={`fv${s}`}
                  markStartColor={BRAND.navy} markEndColor={BRAND.navy} />
              </div>
            </Tile>
          ))}
        </Row>
      </Section>

      {/* ─── 5. Context mocks ─── */}
      <Section title="In context">
        {/* Landing nav */}
        <div style={{ marginBottom: 28 }}>
          <Label style={{ textAlign: "left", marginBottom: 12 }}>Landing nav bar</Label>
          <div style={{
            width: 640,
            background: "rgba(11,18,32,0.94)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "0 24px",
            height: 58,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <RookMarkSVG size={36} gradId="cx1" bgColor={null} rounded={false} />
              <span style={{ fontSize: 17, fontWeight: 700, color: "#F1F5F9", letterSpacing: "0.1em" }}>ROOK</span>
            </div>
            <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#64748B" }}>
              <span>How It Works</span>
              <span>Pricing</span>
              <span style={{ color: BRAND.blue, fontWeight: 600 }}>Get Started →</span>
            </div>
          </div>
        </div>

        {/* Phone home screen */}
        <Row gap={28}>
          <Tile label="Home screen icon">
            <div style={{
              background: "#1C1C2E",
              borderRadius: 20,
              padding: "14px 10px 6px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              width: 76,
            }}>
              <RookMarkSVG size={58} gradId="cx2" />
              <span style={{ fontSize: 9, color: "#fff" }}>Rook</span>
            </div>
          </Tile>

          {/* Notification icon on dark phone UI */}
          <Tile label="Notification badge">
            <div style={{
              background: "#1A1A2E",
              borderRadius: 12,
              padding: 12,
              display: "flex", alignItems: "center", gap: 10,
              width: 260,
            }}>
              <RookMarkSVG size={40} gradId="cx3" />
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#F1F5F9" }}>New threat detected</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>Rook · now</p>
              </div>
            </div>
          </Tile>
        </Row>
      </Section>

      {/* ─── 6. Brand colours ─── */}
      <Section title="Brand colour palette">
        <Row gap={16}>
          {[
            { name: "Navy",       hex: BRAND.navy },
            { name: "Blue 500",   hex: BRAND.blue },
            { name: "Blue 400",   hex: BRAND.blueLight },
            { name: "Blue 100",   hex: BRAND.blueFaint },
          ].map(c => (
            <Tile key={c.name} label={c.name}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: c.hex, border: "1px solid rgba(255,255,255,0.1)" }} />
                <code style={{ fontSize: 9, color: "#475569" }}>{c.hex}</code>
              </div>
            </Tile>
          ))}
        </Row>
      </Section>
    </div>
  );
}
