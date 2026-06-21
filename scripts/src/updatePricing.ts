/**
 * Updates RevenueCat pricing from old values to new spec:
 *   Pro:     $14.99/mo → $9.99/mo  |  $119.99/yr → $83.99/yr
 *   Premium: $49.99/mo → $19.99/mo |  $399.99/yr → $167.99/yr
 *
 * Flow per RC skill docs:
 *  1. Create new v2 products with updated prices
 *  2. Attach new products to entitlements
 *  3. Detach old products from packages, attach new ones
 *  4. Delete old products entirely
 */
import { getUncachableRevenueCatClient } from "./revenueCatClient";
import {
  listProjects,
  listApps,
  listProducts,
  createProduct,
  listEntitlements,
  attachProductsToEntitlement,
  detachProductsFromEntitlement,
  listOfferings,
  listPackages,
  attachProductsToPackage,
  detachProductsFromPackage,
  deleteProduct,
  type App,
  type Product,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

// ── New pricing ───────────────────────────────────────────────────────────────
const NEW_PRODUCTS = [
  {
    label: "Pro Monthly v2",
    identifier: "rook_pro_monthly_v2",
    androidIdentifier: "rook_pro_monthly_v2:monthly",
    oldIdentifier: "rook_pro_monthly",
    duration: "P1M" as const,
    displayName: "Pro — Monthly",
    title: "Pro Monthly",
    prices: [
      { amount_micros: 9990000, currency: "USD" },
      { amount_micros: 9490000, currency: "EUR" },
    ],
    entitlement: "pro",
    offeringKey: "pro",
    packageKey: "$rc_monthly",
  },
  {
    label: "Pro Yearly v2",
    identifier: "rook_pro_yearly_v2",
    androidIdentifier: "rook_pro_yearly_v2:yearly",
    oldIdentifier: "rook_pro_yearly",
    duration: "P1Y" as const,
    displayName: "Pro — Yearly",
    title: "Pro Yearly",
    prices: [
      { amount_micros: 83990000, currency: "USD" },
      { amount_micros: 77990000, currency: "EUR" },
    ],
    entitlement: "pro",
    offeringKey: "pro",
    packageKey: "$rc_annual",
  },
  {
    label: "Premium Monthly v2",
    identifier: "rook_premium_monthly_v2",
    androidIdentifier: "rook_premium_monthly_v2:monthly",
    oldIdentifier: "rook_premium_monthly",
    duration: "P1M" as const,
    displayName: "Premium — Monthly",
    title: "Premium Monthly",
    prices: [
      { amount_micros: 19990000, currency: "USD" },
      { amount_micros: 18990000, currency: "EUR" },
    ],
    entitlement: "premium",
    offeringKey: "premium",
    packageKey: "$rc_monthly",
  },
  {
    label: "Premium Yearly v2",
    identifier: "rook_premium_yearly_v2",
    androidIdentifier: "rook_premium_yearly_v2:yearly",
    oldIdentifier: "rook_premium_yearly",
    duration: "P1Y" as const,
    displayName: "Premium — Yearly",
    title: "Premium Yearly",
    prices: [
      { amount_micros: 167990000, currency: "USD" },
      { amount_micros: 154990000, currency: "EUR" },
    ],
    entitlement: "premium",
    offeringKey: "premium",
    packageKey: "$rc_annual",
  },
];

type TestStorePricesResponse = { object: string; prices: { amount_micros: number; currency: string }[] };

async function run() {
  const client = await getUncachableRevenueCatClient();
  const projectId = process.env["REVENUECAT_PROJECT_ID"]!;
  const testAppId = process.env["REVENUECAT_TEST_STORE_APP_ID"]!;
  const iosAppId  = process.env["REVENUECAT_APPLE_APP_STORE_APP_ID"]!;
  const droidAppId = process.env["REVENUECAT_GOOGLE_PLAY_STORE_APP_ID"]!;

  // ── Load apps ────────────────────────────────────────────────────────────
  const { data: appsData, error: appsErr } = await listApps({ client, path: { project_id: projectId }, query: { limit: 20 } });
  if (appsErr || !appsData) throw new Error("Failed to list apps");

  const testApp   = appsData.items.find((a) => a.id === testAppId)!;
  const iosApp    = appsData.items.find((a) => a.id === iosAppId)!;
  const droidApp  = appsData.items.find((a) => a.id === droidAppId)!;

  console.log("Apps loaded:", testApp.id, iosApp.id, droidApp.id);

  // ── Load existing products ────────────────────────────────────────────────
  const { data: existingProdData, error: listProdErr } = await listProducts({ client, path: { project_id: projectId }, query: { limit: 100 } });
  if (listProdErr) throw new Error("Failed to list products");
  const existing = existingProdData.items ?? [];

  // ── Helper: create a product if it doesn't exist ─────────────────────────
  const ensureProduct = async (
    app: App,
    label: string,
    storeId: string,
    isTest: boolean,
    duration: "P1M" | "P1Y",
    displayName: string,
    title: string
  ): Promise<Product> => {
    const found = existing.find((p) => p.store_identifier === storeId && p.app_id === app.id);
    if (found) { console.log(`  Already exists: ${label} → ${found.id}`); return found; }

    const body: CreateProductData["body"] = {
      store_identifier: storeId,
      app_id: app.id,
      type: "subscription",
      display_name: displayName,
    };
    if (isTest) { body.subscription = { duration }; body.title = title; }

    const { data: created, error } = await createProduct({ client, path: { project_id: projectId }, body });
    if (error) throw new Error(`Failed to create ${label}: ${JSON.stringify(error)}`);
    console.log(`  Created: ${label} → ${created.id}`);
    return created;
  };

  // ── Load entitlements ─────────────────────────────────────────────────────
  const { data: entData, error: entErr } = await listEntitlements({ client, path: { project_id: projectId }, query: { limit: 20 } });
  if (entErr) throw new Error("Failed to list entitlements");
  const proEnt     = entData.items.find((e) => e.lookup_key === "pro")!;
  const premiumEnt = entData.items.find((e) => e.lookup_key === "premium")!;

  // ── Load offerings + packages ─────────────────────────────────────────────
  const { data: offeringData, error: offErr } = await listOfferings({ client, path: { project_id: projectId }, query: { limit: 20 } });
  if (offErr) throw new Error("Failed to list offerings");
  const proOffering     = offeringData.items.find((o) => o.lookup_key === "pro")!;
  const premiumOffering = offeringData.items.find((o) => o.lookup_key === "premium")!;

  const loadPackages = async (offeringId: string) => {
    const { data, error } = await listPackages({ client, path: { project_id: projectId, offering_id: offeringId }, query: { limit: 20 } });
    if (error) throw new Error("Failed to list packages");
    return data.items ?? [];
  };

  const proPackages     = await loadPackages(proOffering.id);
  const premiumPackages = await loadPackages(premiumOffering.id);
  const allPackages = [...proPackages, ...premiumPackages];

  // ── Process each new product ──────────────────────────────────────────────
  for (const p of NEW_PRODUCTS) {
    console.log(`\n── ${p.label} ─────────────────────`);

    // 1. Create new v2 products across all three stores
    const [testProd, iosProd, droidProd] = await Promise.all([
      ensureProduct(testApp,  `[Test] ${p.label}`,    p.identifier,         true,  p.duration, p.displayName, p.title),
      ensureProduct(iosApp,   `[iOS] ${p.label}`,     p.identifier,         false, p.duration, p.displayName, p.title),
      ensureProduct(droidApp, `[Android] ${p.label}`, p.androidIdentifier,  false, p.duration, p.displayName, p.title),
    ]);

    // 2. Add test-store prices to the new test product
    const { error: priceErr } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: projectId, product_id: testProd.id },
      body: { prices: p.prices },
    });
    if (priceErr) {
      const e = priceErr as any;
      if (e?.type === "resource_already_exists") {
        console.log("  Test prices already set");
      } else {
        console.warn("  Warning adding test prices:", JSON.stringify(priceErr));
      }
    } else {
      console.log(`  Test prices set: $${p.prices[0]!.amount_micros / 1_000_000}`);
    }

    // 3. Attach new products to the correct entitlement
    const entitlement = p.entitlement === "pro" ? proEnt : premiumEnt;
    const { error: attEntErr } = await attachProductsToEntitlement({
      client,
      path: { project_id: projectId, entitlement_id: entitlement.id },
      body: { product_ids: [testProd.id, iosProd.id, droidProd.id] },
    });
    if (attEntErr) {
      const e = attEntErr as any;
      if (e?.type === "unprocessable_entity_error") {
        console.log("  Already attached to entitlement");
      } else {
        console.warn("  Warning attaching to entitlement:", JSON.stringify(attEntErr));
      }
    } else {
      console.log(`  Attached to "${p.entitlement}" entitlement`);
    }

    // 4. Find the package for this offering + billing cycle
    const pkg = allPackages.find((pk) =>
      (p.offeringKey === "pro" ? proPackages : premiumPackages).includes(pk) &&
      pk.lookup_key === p.packageKey
    );

    if (!pkg) {
      console.warn(`  Package "${p.packageKey}" not found in "${p.offeringKey}" offering — skipping`);
      continue;
    }

    // 5. Find old products to detach
    const oldTestProd   = existing.find((prod) => prod.store_identifier === p.oldIdentifier && prod.app_id === testApp.id);
    const oldIosProd    = existing.find((prod) => prod.store_identifier === p.oldIdentifier && prod.app_id === iosApp.id);
    const oldDroidProd  = existing.find((prod) => prod.store_identifier === p.oldIdentifier && prod.app_id === droidApp.id);

    const oldIds = [oldTestProd?.id, oldIosProd?.id, oldDroidProd?.id].filter(Boolean) as string[];

    if (oldIds.length > 0) {
      const { error: detachPkgErr } = await detachProductsFromPackage({
        client,
        path: { project_id: projectId, package_id: pkg.id },
        body: { product_ids: oldIds },
      });
      if (detachPkgErr) console.warn("  Warning detaching old products from package:", JSON.stringify(detachPkgErr));
      else console.log(`  Detached ${oldIds.length} old products from package "${p.packageKey}"`);

      const { error: detachEntErr } = await detachProductsFromEntitlement({
        client,
        path: { project_id: projectId, entitlement_id: entitlement.id },
        body: { product_ids: oldIds },
      });
      if (detachEntErr) console.warn("  Warning detaching old products from entitlement:", JSON.stringify(detachEntErr));
      else console.log(`  Detached old products from entitlement`);
    }

    // 6. Attach new products to package
    const { error: attPkgErr } = await attachProductsToPackage({
      client,
      path: { project_id: projectId, package_id: pkg.id },
      body: {
        products: [
          { product_id: testProd.id,  eligibility_criteria: "all" },
          { product_id: iosProd.id,   eligibility_criteria: "all" },
          { product_id: droidProd.id, eligibility_criteria: "all" },
        ],
      },
    });
    if (attPkgErr) {
      const e = attPkgErr as any;
      if (e?.type === "unprocessable_entity_error") {
        console.log(`  New products already in package "${p.packageKey}"`);
      } else {
        console.warn("  Warning attaching new products to package:", JSON.stringify(attPkgErr));
      }
    } else {
      console.log(`  New products attached to package "${p.packageKey}"`);
    }

    // 7. Delete old products entirely (critical — RC may still resolve stale ones)
    for (const [label2, oldProd] of [
      ["[Test]", oldTestProd], ["[iOS]", oldIosProd], ["[Android]", oldDroidProd],
    ] as [string, Product | undefined][]) {
      if (!oldProd) continue;
      const { error: delErr } = await deleteProduct({ client, path: { project_id: projectId, product_id: oldProd.id } });
      if (delErr) console.warn(`  Warning deleting ${label2} old product ${oldProd.id}:`, JSON.stringify(delErr));
      else console.log(`  Deleted ${label2} old product ${oldProd.id}`);
    }
  }

  console.log("\n✅ Pricing update complete!");
  console.log("   Pro:     $9.99/mo | $83.99/yr");
  console.log("   Premium: $19.99/mo | $167.99/yr");
}

run().catch(console.error);
