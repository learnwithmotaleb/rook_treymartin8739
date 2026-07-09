import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "Rook";

// iOS/Android store identifiers
const IOS_BUNDLE_ID = "com.getrook.app";
const ANDROID_PACKAGE = "com.getrook.app";

// One-time scan unlock product
const SCAN_UNLOCK_PRODUCT = {
  label: "Scan Unlock",
  identifier: "scan_unlock_v1",
  androidIdentifier: "scan_unlock_v1",
  displayName: "Rook Single Scan Unlock",
  title: "Rook Scan Unlock",
  prices: [
    { amount_micros: 2990000, currency: "USD" },  // $2.99
    { amount_micros: 2790000, currency: "EUR" },  // €2.79
  ],
};

// Products: 2 tiers × 2 billing cycles
const PRODUCTS = [
  {
    label: "Pro Monthly",
    identifier: "rook_pro_monthly",
    androidIdentifier: "rook_pro_monthly:monthly",
    duration: "P1M" as const,
    displayName: "Rook Pro — Monthly",
    title: "Rook Pro Monthly",
    prices: [
      { amount_micros: 14990000, currency: "USD" },  // $14.99
      { amount_micros: 13990000, currency: "EUR" },  // €13.99
    ],
    entitlement: "pro",
    offeringKey: "pro",
    packageKey: "$rc_monthly",
    packageDisplay: "Pro Monthly",
  },
  {
    label: "Pro Yearly",
    identifier: "rook_pro_yearly",
    androidIdentifier: "rook_pro_yearly:yearly",
    duration: "P1Y" as const,
    displayName: "Rook Pro — Yearly",
    title: "Rook Pro Yearly",
    prices: [
      { amount_micros: 95880000, currency: "USD" },  // $95.88 ($7.99/mo, save 33%)
      { amount_micros: 87880000, currency: "EUR" },  // €87.88
    ],
    entitlement: "pro",
    offeringKey: "pro",
    packageKey: "$rc_annual",
    packageDisplay: "Pro Annual",
  },
  {
    label: "Premium Monthly",
    identifier: "rook_premium_monthly",
    androidIdentifier: "rook_premium_monthly:monthly",
    duration: "P1M" as const,
    displayName: "Rook Premium — Monthly",
    title: "Rook Premium Monthly",
    prices: [
      { amount_micros: 24990000, currency: "USD" },  // $24.99
      { amount_micros: 22990000, currency: "EUR" },  // €22.99
    ],
    entitlement: "premium",
    offeringKey: "premium",
    packageKey: "$rc_monthly",
    packageDisplay: "Premium Monthly",
  },
  {
    label: "Premium Yearly",
    identifier: "rook_premium_yearly",
    androidIdentifier: "rook_premium_yearly:yearly",
    duration: "P1Y" as const,
    displayName: "Rook Premium — Yearly",
    title: "Rook Premium Yearly",
    prices: [
      { amount_micros: 203880000, currency: "USD" }, // $203.88 ($16.99/mo, save 32%)
      { amount_micros: 185880000, currency: "EUR" }, // €185.88
    ],
    entitlement: "premium",
    offeringKey: "premium",
    packageKey: "$rc_annual",
    packageDisplay: "Premium Annual",
  },
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  // ── Project ──────────────────────────────────────────────────────────────
  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error("Failed to list projects");

  // Reuse any existing project (RC Replit accounts typically have one project)
  const existingProject =
    existingProjects.items?.find((p) => p.name === PROJECT_NAME) ??
    existingProjects.items?.[0];

  if (existingProject) {
    console.log("Using existing project:", existingProject.id, `"${existingProject.name}"`);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({ client, body: { name: PROJECT_NAME } });
    if (error) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  // ── Apps ─────────────────────────────────────────────────────────────────
  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) throw new Error("No apps found");

  let testApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testApp) throw new Error("No test store app found in project");
  console.log("Test Store app:", testApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: "Rook iOS", type: "app_store", app_store: { bundle_id: IOS_BUNDLE_ID } },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: "Rook Android", type: "play_store", play_store: { package_name: ANDROID_PACKAGE } },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app:", playStoreApp.id);
  }

  // ── Products ─────────────────────────────────────────────────────────────
  const { data: existingProductsData, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (
    targetApp: App,
    label: string,
    storeIdentifier: string,
    isTestStore: boolean,
    duration: "P1M" | "P1Y",
    displayName: string,
    userFacingTitle: string
  ): Promise<Product> => {
    const existing = existingProductsData.items?.find(
      (p) => p.store_identifier === storeIdentifier && p.app_id === targetApp.id
    );
    if (existing) {
      console.log(`${label} product exists:`, existing.id);
      return existing;
    }
    const body: CreateProductData["body"] = {
      store_identifier: storeIdentifier,
      app_id: targetApp.id,
      type: "subscription",
      display_name: displayName,
    };
    if (isTestStore) {
      body.subscription = { duration };
      body.title = userFacingTitle;
    }
    const { data: created, error } = await createProduct({ client, path: { project_id: project.id }, body });
    if (error) throw new Error(`Failed to create ${label} product: ${JSON.stringify(error)}`);
    console.log(`Created ${label} product:`, created.id);
    return created;
  };

  const createdProducts: Record<string, { test: Product; appStore: Product; playStore: Product }> = {};

  for (const p of PRODUCTS) {
    const [test, appStore, playStore] = await Promise.all([
      ensureProduct(testApp, `[Test] ${p.label}`, p.identifier, true, p.duration, p.displayName, p.title),
      ensureProduct(appStoreApp, `[iOS] ${p.label}`, p.identifier, false, p.duration, p.displayName, p.title),
      ensureProduct(playStoreApp, `[Android] ${p.label}`, p.androidIdentifier, false, p.duration, p.displayName, p.title),
    ]);
    createdProducts[p.identifier] = { test, appStore, playStore };

    // Add test store prices
    const { error: priceError } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: test.id },
      body: { prices: p.prices },
    });
    if (priceError) {
      const err = priceError as any;
      if (err?.type === "resource_already_exists") {
        console.log(`Test store prices already exist for ${p.label}`);
      } else {
        console.warn(`Warning: couldn't add test store prices for ${p.label}:`, JSON.stringify(priceError));
      }
    } else {
      console.log(`Added test store prices for ${p.label}`);
    }
  }

  // ── Entitlements ─────────────────────────────────────────────────────────
  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const ensureEntitlement = async (lookupKey: string, displayName: string): Promise<Entitlement> => {
    const existing = existingEntitlements.items?.find((e) => e.lookup_key === lookupKey);
    if (existing) {
      console.log(`Entitlement "${lookupKey}" exists:`, existing.id);
      return existing;
    }
    const { data: created, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: lookupKey, display_name: displayName },
    });
    if (error) throw new Error(`Failed to create entitlement "${lookupKey}"`);
    console.log(`Created entitlement "${lookupKey}":`, created.id);
    return created;
  };

  const proEntitlement = await ensureEntitlement("pro", "Pro Access");
  const premiumEntitlement = await ensureEntitlement("premium", "Premium Access");

  // Attach products to entitlements
  for (const [entitlement, entitlementKey] of [
    [proEntitlement, "pro"],
    [premiumEntitlement, "premium"],
  ] as [Entitlement, string][]) {
    const productIds = PRODUCTS.filter((p) => p.entitlement === entitlementKey).flatMap((p) => {
      const prods = createdProducts[p.identifier];
      return prods ? [prods.test.id, prods.appStore.id, prods.playStore.id] : [];
    });

    const { error } = await attachProductsToEntitlement({
      client,
      path: { project_id: project.id, entitlement_id: entitlement.id },
      body: { product_ids: productIds },
    });
    if (error) {
      const e = error as any;
      if (e?.type === "unprocessable_entity_error") {
        console.log(`Products already attached to "${entitlementKey}" entitlement`);
      } else {
        throw new Error(`Failed to attach products to "${entitlementKey}" entitlement`);
      }
    } else {
      console.log(`Attached products to "${entitlementKey}" entitlement`);
    }
  }

  // ── Offerings + Packages ─────────────────────────────────────────────────
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  const ensureOffering = async (lookupKey: string, displayName: string): Promise<Offering> => {
    const existing = existingOfferings.items?.find((o) => o.lookup_key === lookupKey);
    if (existing) {
      console.log(`Offering "${lookupKey}" exists:`, existing.id);
      return existing;
    }
    const { data: created, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: lookupKey, display_name: displayName },
    });
    if (error) throw new Error(`Failed to create offering "${lookupKey}"`);
    console.log(`Created offering "${lookupKey}":`, created.id);
    return created;
  };

  const proOffering = await ensureOffering("pro", "Pro Plans");
  const premiumOffering = await ensureOffering("premium", "Premium Plans");

  // Set "pro" as the current/default offering
  if (!proOffering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: proOffering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set pro offering as current");
    console.log("Set pro offering as current");
  }

  const ensurePackage = async (
    offering: Offering,
    packageKey: string,
    packageDisplay: string,
    productIdentifier: string
  ): Promise<Package> => {
    const { data: existingPkgs, error: listPkgError } = await listPackages({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      query: { limit: 20 },
    });
    if (listPkgError) throw new Error("Failed to list packages");

    let pkg = existingPkgs.items?.find((p) => p.lookup_key === packageKey);
    if (!pkg) {
      const { data: newPkg, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: packageKey, display_name: packageDisplay },
      });
      if (error) throw new Error(`Failed to create package "${packageKey}"`);
      console.log(`Created package "${packageKey}":`, newPkg.id);
      pkg = newPkg;
    } else {
      console.log(`Package "${packageKey}" exists:`, pkg.id);
    }

    const prods = createdProducts[productIdentifier];
    if (!prods) throw new Error(`No products found for identifier: ${productIdentifier}`);

    const { error: attachError } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: prods.test.id, eligibility_criteria: "all" },
          { product_id: prods.appStore.id, eligibility_criteria: "all" },
          { product_id: prods.playStore.id, eligibility_criteria: "all" },
        ],
      },
    });
    if (attachError) {
      const e = attachError as any;
      if (e?.type === "unprocessable_entity_error") {
        console.log(`Package "${packageKey}" already has products attached`);
      } else {
        throw new Error(`Failed to attach products to package "${packageKey}": ${JSON.stringify(attachError)}`);
      }
    } else {
      console.log(`Attached products to package "${packageKey}"`);
    }

    return pkg;
  };

  // Pro offering packages
  await ensurePackage(proOffering, "$rc_monthly", "Pro Monthly", "rook_pro_monthly");
  await ensurePackage(proOffering, "$rc_annual", "Pro Annual", "rook_pro_yearly");

  // Premium offering packages
  await ensurePackage(premiumOffering, "$rc_monthly", "Premium Monthly", "rook_premium_monthly");
  await ensurePackage(premiumOffering, "$rc_annual", "Premium Annual", "rook_premium_yearly");

  // ── Scan Unlock (one-time, non-consumable) ────────────────────────────────
  const ensureOneTimeProduct = async (
    targetApp: App,
    label: string,
    storeIdentifier: string,
    isTestStore: boolean,
    displayName: string,
    userFacingTitle: string
  ): Promise<Product> => {
    const existing = existingProductsData.items?.find(
      (p) => p.store_identifier === storeIdentifier && p.app_id === targetApp.id
    );
    if (existing) {
      console.log(`${label} product exists:`, existing.id);
      return existing;
    }
    const body: CreateProductData["body"] = {
      store_identifier: storeIdentifier,
      app_id: targetApp.id,
      type: "non_consumable",
      display_name: displayName,
    };
    if (isTestStore) {
      body.title = userFacingTitle;
    }
    const { data: created, error } = await createProduct({ client, path: { project_id: project.id }, body });
    if (error) throw new Error(`Failed to create ${label} product: ${JSON.stringify(error)}`);
    console.log(`Created ${label} product:`, created.id);
    return created;
  };

  const [scanUnlockTest, scanUnlockAppStore, scanUnlockPlayStore] = await Promise.all([
    ensureOneTimeProduct(testApp, "[Test] Scan Unlock", SCAN_UNLOCK_PRODUCT.identifier, true, SCAN_UNLOCK_PRODUCT.displayName, SCAN_UNLOCK_PRODUCT.title),
    ensureOneTimeProduct(appStoreApp, "[iOS] Scan Unlock", SCAN_UNLOCK_PRODUCT.identifier, false, SCAN_UNLOCK_PRODUCT.displayName, SCAN_UNLOCK_PRODUCT.title),
    ensureOneTimeProduct(playStoreApp, "[Android] Scan Unlock", SCAN_UNLOCK_PRODUCT.androidIdentifier, false, SCAN_UNLOCK_PRODUCT.displayName, SCAN_UNLOCK_PRODUCT.title),
  ]);

  // Add test store prices for scan unlock
  const { error: scanPriceError } = await client.post<TestStorePricesResponse>({
    url: "/projects/{project_id}/products/{product_id}/test_store_prices",
    path: { project_id: project.id, product_id: scanUnlockTest.id },
    body: { prices: SCAN_UNLOCK_PRODUCT.prices },
  });
  if (scanPriceError) {
    const err = scanPriceError as any;
    if (err?.type === "resource_already_exists") {
      console.log("Test store prices already exist for Scan Unlock");
    } else {
      console.warn("Warning: couldn't add test store prices for Scan Unlock:", JSON.stringify(scanPriceError));
    }
  } else {
    console.log("Added test store prices for Scan Unlock");
  }

  // scan_unlocked entitlement
  const scanUnlockEntitlement = await ensureEntitlement("scan_unlocked", "Scan Unlock");
  const { error: scanEntitlementAttachError } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: scanUnlockEntitlement.id },
    body: { product_ids: [scanUnlockTest.id, scanUnlockAppStore.id, scanUnlockPlayStore.id] },
  });
  if (scanEntitlementAttachError) {
    const e = scanEntitlementAttachError as any;
    if (e?.type === "unprocessable_entity_error") {
      console.log('Products already attached to "scan_unlocked" entitlement');
    } else {
      throw new Error(`Failed to attach products to "scan_unlocked" entitlement`);
    }
  } else {
    console.log('Attached products to "scan_unlocked" entitlement');
  }

  // scan_unlock offering + $rc_lifetime package
  const scanUnlockOffering = await ensureOffering("scan_unlock", "Scan Unlock");
  const { data: scanUnlockPkgs, error: listScanPkgsError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: scanUnlockOffering.id },
    query: { limit: 20 },
  });
  if (listScanPkgsError) throw new Error("Failed to list scan_unlock packages");

  let scanUnlockPkg = scanUnlockPkgs.items?.find((p) => p.lookup_key === "$rc_lifetime");
  if (!scanUnlockPkg) {
    const { data: newPkg, error } = await createPackages({
      client,
      path: { project_id: project.id, offering_id: scanUnlockOffering.id },
      body: { lookup_key: "$rc_lifetime", display_name: "Scan Unlock One-Time" },
    });
    if (error) throw new Error(`Failed to create scan_unlock $rc_lifetime package`);
    console.log('Created package "$rc_lifetime" in scan_unlock offering:', newPkg.id);
    scanUnlockPkg = newPkg;
  } else {
    console.log('Package "$rc_lifetime" in scan_unlock exists:', scanUnlockPkg.id);
  }

  const { error: scanPkgAttachError } = await attachProductsToPackage({
    client,
    path: { project_id: project.id, package_id: scanUnlockPkg.id },
    body: {
      products: [
        { product_id: scanUnlockTest.id, eligibility_criteria: "all" },
        { product_id: scanUnlockAppStore.id, eligibility_criteria: "all" },
        { product_id: scanUnlockPlayStore.id, eligibility_criteria: "all" },
      ],
    },
  });
  if (scanPkgAttachError) {
    const e = scanPkgAttachError as any;
    if (e?.type === "unprocessable_entity_error") {
      console.log('Package "$rc_lifetime" already has scan_unlock_v1 products attached');
    } else {
      throw new Error(`Failed to attach products to scan_unlock package: ${JSON.stringify(scanPkgAttachError)}`);
    }
  } else {
    console.log('Attached scan_unlock_v1 products to "$rc_lifetime" package');
  }

  // ── API Keys ─────────────────────────────────────────────────────────────
  const getKeys = async (app: App) => {
    const { data, error } = await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: app.id },
    });
    if (error) throw new Error(`Failed to list API keys for app ${app.id}`);
    return data?.items.map((k) => k.key).join(", ") ?? "N/A";
  };

  const [testKeys, appStoreKeys, playStoreKeys] = await Promise.all([
    getKeys(testApp),
    getKeys(appStoreApp),
    getKeys(playStoreApp),
  ]);

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:              ", project.id);
  console.log("Test Store App ID:       ", testApp.id);
  console.log("App Store App ID:        ", appStoreApp.id);
  console.log("Play Store App ID:       ", playStoreApp.id);
  console.log("Entitlements:             pro, premium, scan_unlocked");
  console.log("Offerings:                pro (default), premium, scan_unlock");
  console.log("");
  console.log("Set these environment variables:");
  console.log("  REVENUECAT_PROJECT_ID =                     ", project.id);
  console.log("  REVENUECAT_TEST_STORE_APP_ID =              ", testApp.id);
  console.log("  REVENUECAT_APPLE_APP_STORE_APP_ID =         ", appStoreApp.id);
  console.log("  REVENUECAT_GOOGLE_PLAY_STORE_APP_ID =       ", playStoreApp.id);
  console.log("  EXPO_PUBLIC_REVENUECAT_TEST_API_KEY =       ", testKeys);
  console.log("  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY =        ", appStoreKeys);
  console.log("  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY =    ", playStoreKeys);
  console.log("====================\n");
}

seedRevenueCat().catch(console.error);
