/**
 * Inspects the current RC app configurations and updates the iOS and Android
 * bundle ID / package name to com.getrook.app wherever it's wrong.
 */
import { getUncachableRevenueCatClient } from "./revenueCatClient";
import { listApps, updateApp } from "@replit/revenuecat-sdk";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;
const IOS_APP_ID = process.env.REVENUECAT_APPLE_APP_STORE_APP_ID!;
const ANDROID_APP_ID = process.env.REVENUECAT_GOOGLE_PLAY_STORE_APP_ID!;
const TARGET_BUNDLE = "com.getrook.app";

async function main() {
  const client = await getUncachableRevenueCatClient();

  // ── Inspect ─────────────────────────────────────────────────────────────────
  const { data: apps, error: listErr } = await listApps({
    client,
    path: { project_id: PROJECT_ID },
    query: { limit: 20 },
  });
  if (listErr || !apps) {
    console.error("Failed to list apps:", listErr);
    process.exit(1);
  }

  console.log("\n=== Current apps ===");
  for (const app of apps.items) {
    const bundleInfo =
      app.type === "app_store"
        ? `bundle_id=${(app as any).app_store?.bundle_id ?? "(none)"}`
        : app.type === "play_store"
        ? `package_name=${(app as any).play_store?.package_name ?? "(none)"}`
        : app.type === "test_store"
        ? "(test store — no bundle ID)"
        : "";
    console.log(`  [${app.type}] ${app.id}  name="${app.name}"  ${bundleInfo}`);
  }

  // ── Fix iOS ──────────────────────────────────────────────────────────────────
  const iosApp = apps.items.find((a) => a.id === IOS_APP_ID);
  if (!iosApp) {
    console.error(`\nCould not find iOS app ${IOS_APP_ID} in list`);
  } else {
    const currentBundle = (iosApp as any).app_store?.bundle_id ?? "";
    if (currentBundle === TARGET_BUNDLE) {
      console.log(`\niOS bundle ID already correct: ${currentBundle}`);
    } else {
      console.log(`\nUpdating iOS bundle ID: "${currentBundle}" → "${TARGET_BUNDLE}"`);
      const { data: updated, error: updateErr } = await updateApp({
        client,
        path: { project_id: PROJECT_ID, app_id: IOS_APP_ID },
        body: { app_store: { bundle_id: TARGET_BUNDLE } },
      });
      if (updateErr) {
        console.error("iOS update failed:", JSON.stringify(updateErr, null, 2));
      } else {
        console.log(`✓ iOS updated → bundle_id=${(updated as any).app_store?.bundle_id}`);
      }
    }
  }

  // ── Fix Android ──────────────────────────────────────────────────────────────
  const androidApp = apps.items.find((a) => a.id === ANDROID_APP_ID);
  if (!androidApp) {
    console.error(`\nCould not find Android app ${ANDROID_APP_ID} in list`);
  } else {
    const currentPkg = (androidApp as any).play_store?.package_name ?? "";
    if (currentPkg === TARGET_BUNDLE) {
      console.log(`\nAndroid package name already correct: ${currentPkg}`);
    } else {
      console.log(`\nUpdating Android package name: "${currentPkg}" → "${TARGET_BUNDLE}"`);
      const { data: updated, error: updateErr } = await updateApp({
        client,
        path: { project_id: PROJECT_ID, app_id: ANDROID_APP_ID },
        body: { play_store: { package_name: TARGET_BUNDLE } },
      });
      if (updateErr) {
        console.error("Android update failed:", JSON.stringify(updateErr, null, 2));
      } else {
        console.log(`✓ Android updated → package_name=${(updated as any).play_store?.package_name}`);
      }
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
