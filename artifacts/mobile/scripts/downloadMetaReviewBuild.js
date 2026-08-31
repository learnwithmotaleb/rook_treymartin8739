const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const projectRoot = path.resolve(__dirname, "..");
const archivePath = path.join(projectRoot, "meta-review-build.tar.gz");
const extractDir = path.join(projectRoot, "meta-review-build");

function runEas(args) {
  return execFileSync("eas", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function parseJsonOutput(raw) {
  const jsonStart = raw.search(/[\[{]/);
  if (jsonStart === -1) {
    throw new Error("EAS did not return JSON output.");
  }
  return JSON.parse(raw.slice(jsonStart));
}

function findAppBundle(directory) {
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory() && entry.name.endsWith(".app")) return fullPath;
      if (entry.isDirectory()) pending.push(fullPath);
    }
  }
  return null;
}

async function main() {
  const raw = runEas([
    "build:list",
    "--platform",
    "ios",
    "--profile",
    "meta-review",
    "--status",
    "finished",
    "--limit",
    "1",
    "--json",
    "--non-interactive",
  ]);
  const builds = parseJsonOutput(raw);
  const build = builds[0];
  const buildUrl = build?.artifacts?.buildUrl;
  if (!build?.id || !buildUrl) {
    throw new Error("No finished meta-review iOS build with a downloadable artifact was found.");
  }

  const response = await fetch(buildUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Could not download EAS build ${build.id}: HTTP ${response.status}`);
  }

  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(archivePath));
  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync("tar", ["-xzf", archivePath, "-C", extractDir], { stdio: "inherit" });

  const appBundle = findAppBundle(extractDir);
  if (!appBundle) {
    throw new Error(`Downloaded EAS artifact did not contain an .app bundle: ${archivePath}`);
  }

  const checksum = crypto
    .createHash("sha256")
    .update(fs.readFileSync(archivePath))
    .digest("hex");

  console.log(`EAS build ID: ${build.id}`);
  console.log(`Simulator bundle: ${path.relative(projectRoot, appBundle)}`);
  console.log(`Archive SHA-256: ${checksum}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});