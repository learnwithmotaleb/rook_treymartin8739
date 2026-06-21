import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(
  __dirname,
  "../../artifacts/mobile/assets/images"
);

function shieldSvg(size: number): Buffer {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;

  const blur1 = Math.round(s * 0.025);
  const blur2 = Math.round(s * 0.045);
  const sw = Math.round(s * 0.004);
  const ck = Math.round(s * 0.012);
  const ckGlow = Math.round(s * 0.024);

  const shx = cx - s * 0.285;
  const shy = cy - s * 0.335;
  const shw = s * 0.57;
  const shh = s * 0.68;

  const t = shy;
  const b = shy + shh;
  const l = shx;
  const r = shx + shw;
  const m = cx;

  const ckx1 = cx - s * 0.095;
  const cky1 = cy + s * 0.04;
  const ckx2 = cx - s * 0.02;
  const cky2 = cy + s * 0.14;
  const ckx3 = cx + s * 0.13;
  const cky3 = cy - s * 0.065;

  const shieldPath = `M${m},${t} L${r},${t + shh * 0.21} L${r},${t + shh * 0.61} Q${r},${b} ${m},${b} Q${l},${b} ${l},${t + shh * 0.61} L${l},${t + shh * 0.21} Z`;
  const innerPath = `M${m},${t + s * 0.038} L${r - s * 0.02},${t + shh * 0.22} L${r - s * 0.02},${t + shh * 0.60} Q${r - s * 0.02},${b - s * 0.04} ${m},${b - s * 0.04}`;
  const ckPath = `M${ckx1},${cky1} L${ckx2},${cky2} L${ckx3},${cky3}`;

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="44%" r="62%">
      <stop offset="0%" stop-color="#0e1f36"/>
      <stop offset="100%" stop-color="#070B12"/>
    </radialGradient>
    <radialGradient id="shieldGrad" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#12294a"/>
      <stop offset="100%" stop-color="#081220"/>
    </radialGradient>
    <filter id="ambient" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${blur2}" result="b"/>
      <feComposite in="b" in2="SourceGraphic" operator="over"/>
    </filter>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${blur1}" result="b"/>
      <feComposite in="b" in2="SourceGraphic" operator="over"/>
    </filter>
  </defs>

  <rect width="${s}" height="${s}" fill="url(#bgGrad)"/>

  <ellipse cx="${cx}" cy="${cy - s * 0.025}" rx="${s * 0.31}" ry="${s * 0.37}"
    fill="#1d4ed8" opacity="0.13" filter="url(#ambient)"/>

  <path d="${shieldPath}"
    fill="none" stroke="#3B82F6" stroke-width="${sw * 6}"
    opacity="0.22" filter="url(#ambient)"/>

  <path d="${shieldPath}"
    fill="url(#shieldGrad)" stroke="#3B82F6" stroke-width="${sw}"/>

  <path d="${innerPath}"
    fill="none" stroke="#60a5fa" stroke-width="${sw * 0.6}" opacity="0.28"/>

  <line x1="${l + shw * 0.22}" y1="${cy - s * 0.015}" x2="${r - shw * 0.14}" y2="${cy - s * 0.015}"
    stroke="#3B82F6" stroke-width="${sw * 0.8}" opacity="0.30"/>
  <line x1="${l + shw * 0.22}" y1="${cy + s * 0.04}" x2="${cx - s * 0.02}" y2="${cy + s * 0.04}"
    stroke="#3B82F6" stroke-width="${sw * 0.8}" opacity="0.20"/>
  <line x1="${cx + s * 0.06}" y1="${cy - s * 0.09}" x2="${cx + s * 0.06}" y2="${cy + s * 0.04}"
    stroke="#3B82F6" stroke-width="${sw * 0.8}" opacity="0.20"/>

  <path d="${ckPath}"
    fill="none" stroke="#3B82F6" stroke-width="${ckGlow}"
    stroke-linecap="round" stroke-linejoin="round"
    opacity="0.32" filter="url(#glow)"/>

  <path d="${ckPath}"
    fill="none" stroke="#7ec8ff" stroke-width="${ck}"
    stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
  );
}

async function renderSvg(
  svgBuf: Buffer,
  outputPath: string,
  label: string
): Promise<void> {
  await sharp(svgBuf)
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
  console.log(`✓ ${label}`);
}

async function main(): Promise<void> {
  console.log("Generating Rook app icons...\n");

  await renderSvg(
    shieldSvg(1024),
    path.join(ASSETS, "icon.png"),
    "icon.png              1024×1024"
  );

  await renderSvg(
    shieldSvg(1024),
    path.join(ASSETS, "adaptive-icon.png"),
    "adaptive-icon.png     1024×1024"
  );

  await renderSvg(
    shieldSvg(2048),
    path.join(ASSETS, "splash.png"),
    "splash.png            2048×2048"
  );

  console.log("\nAll assets written to artifacts/mobile/assets/images/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
