// Load .env.local overrides FIRST — these win over Replit-injected env vars.
// Needed because Replit secrets take a full workspace restart to propagate;
// .env.local lets us hot-patch values without restarting the entire workspace.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dir = dirname(fileURLToPath(import.meta.url));
const envLocal = resolve(__dir, "../.env.local");
if (existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

import app from "./app";
import { logger } from "./lib/logger";
import { startWebhookRetryLoop } from "./services/webhookService";
import { startScheduledScanLoop, startTokenRefreshLoop, startNotificationSchedulerLoop } from "./services/schedulerService";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Wrap each background loop in try/catch so a startup error in one
  // does not silently prevent the others from starting.
  try { startWebhookRetryLoop(); } catch (err) { logger.error({ err }, "Failed to start webhook retry loop"); }
  try { startScheduledScanLoop(); } catch (err) { logger.error({ err }, "Failed to start scheduled scan loop"); }
  try { startTokenRefreshLoop(); } catch (err) { logger.error({ err }, "Failed to start token refresh loop"); }
  try { startNotificationSchedulerLoop(); } catch (err) { logger.error({ err }, "Failed to start notification scheduler loop"); }
});
