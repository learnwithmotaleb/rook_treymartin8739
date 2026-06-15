import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(
  __dirname,
  "../../artifacts/mobile/assets/images"
);
const LOGO = path.join(ASSETS, "logo.png");

async function makeIcon(
  outputPath: string,
  canvasSize: number,
  logoSize: number
): Promise<void> {
  const logoBuffer = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const offset = Math.round((canvasSize - logoSize) / 2);

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 3,
      background: { r: 7, g: 11, b: 18 },
    },
  })
    .composite([{ input: logoBuffer, top: offset, left: offset }])
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outputPath);
}

async function makeSplash(
  outputPath: string,
  canvasSize: number,
  logoSize: number
): Promise<void> {
  const logoBuffer = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const offset = Math.round((canvasSize - logoSize) / 2);
  const verticalOffset = Math.round((canvasSize - logoSize) / 2);

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 3,
      background: { r: 7, g: 11, b: 18 },
    },
  })
    .composite([{ input: logoBuffer, top: verticalOffset, left: offset }])
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outputPath);
}

async function main(): Promise<void> {
  console.log("Generating ShieldID app icons...\n");

  await makeIcon(path.join(ASSETS, "icon.png"), 1024, 640);
  console.log("✓ icon.png              1024×1024");

  await makeIcon(path.join(ASSETS, "adaptive-icon.png"), 1024, 640);
  console.log("✓ adaptive-icon.png     1024×1024");

  await makeSplash(path.join(ASSETS, "splash.png"), 2048, 900);
  console.log("✓ splash.png            2048×2048");

  console.log("\nAll assets written to artifacts/mobile/assets/images/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
