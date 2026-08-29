import {
  attachProductsToEntitlement,
  attachProductsToPackage,
  createProduct,
  detachProductsFromPackage,
  listApps,
  listEntitlements,
  listOfferings,
  listPackages,
  listProducts,
  updateOffering,
  type App,
  type CreateProductData,
  type Package,
  type Product,
} from "@replit/revenuecat-sdk";

import { getUncachableRevenueCatClient } from "./revenueCatClient";

const PRODUCTS = [
  {
    cycle: "monthly",
    iosAndTestId: "premium_monthly_v2",
    androidId: "premium_monthly_v2:monthly",
    duration: "P1M" as const,
    priceMicros: 9_990_000,
    packageKey: "$rc_monthly",
  },
  {
    cycle: "annual",
    iosAndTestId: "premium_annual_v2",
    androidId: "premium_annual_v2:annual",
    duration: "P1Y" as const,
    priceMicros: 69_990_000,
    packageKey: "$rc_annual",
  },
] as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function run() {
  const projectId = required("REVENUECAT_PROJECT_ID");
  const appIds = {
    test: required("REVENUECAT_TEST_STORE_APP_ID"),
    ios: required("REVENUECAT_APPLE_APP_STORE_APP_ID"),
    android: required("REVENUECAT_GOOGLE_PLAY_STORE_APP_ID"),
  };
  const client = await getUncachableRevenueCatClient();

  const [
    { data: appsData, error: appsError },
    { data: productsData, error: productsError },
    { data: entitlementsData, error: entitlementsError },
    { data: offeringsData, error: offeringsError },
  ] = await Promise.all([
    listApps({ client, path: { project_id: projectId }, query: { limit: 100 } }),
    listProducts({ client, path: { project_id: projectId }, query: { limit: 100 } }),
    listEntitlements({ client, path: { project_id: projectId }, query: { limit: 100 } }),
    listOfferings({ client, path: { project_id: projectId }, query: { limit: 100 } }),
  ]);
  if (appsError || productsError || entitlementsError || offeringsError) {
    throw new Error("Failed to load the RevenueCat catalog.");
  }

  const findApp = (id: string): App => {
    const app = appsData.items.find((item) => item.id === id);
    if (!app) throw new Error(`RevenueCat app ${id} was not found.`);
    return app;
  };
  const apps = {
    test: findApp(appIds.test),
    ios: findApp(appIds.ios),
    android: findApp(appIds.android),
  };
  const existingProducts = productsData.items ?? [];

  async function ensureProduct(
    app: App,
    storeIdentifier: string,
    cycle: "monthly" | "annual",
    duration: "P1M" | "P1Y",
    platform: "Test" | "iOS" | "Android",
  ): Promise<Product> {
    const existing = existingProducts.find(
      (item) => item.app_id === app.id && item.store_identifier === storeIdentifier,
    );
    if (existing) return existing;

    const body: CreateProductData["body"] = {
      app_id: app.id,
      store_identifier: storeIdentifier,
      type: "subscription",
      display_name: `Rook Premium ${cycle === "monthly" ? "Monthly" : "Annual"} (${platform})`,
    };
    if (platform === "Test") {
      body.subscription = { duration };
      body.title = `Rook Premium ${cycle === "monthly" ? "Monthly" : "Annual"}`;
    }
    const { data, error } = await createProduct({
      client,
      path: { project_id: projectId },
      body,
    });
    if (error) {
      throw new Error(
        `Failed to create ${platform} ${cycle} product: ${JSON.stringify(error)}`,
      );
    }
    return data;
  }

  const premiumProducts: Record<string, Product[]> = {};
  for (const product of PRODUCTS) {
    const created = await Promise.all([
      ensureProduct(apps.test, product.iosAndTestId, product.cycle, product.duration, "Test"),
      ensureProduct(apps.ios, product.iosAndTestId, product.cycle, product.duration, "iOS"),
      ensureProduct(apps.android, product.androidId, product.cycle, product.duration, "Android"),
    ]);
    premiumProducts[product.packageKey] = created;

    const { error } = await client.post({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: projectId, product_id: created[0]!.id },
      body: {
        prices: [
          { amount_micros: product.priceMicros, currency: "USD" },
        ],
      },
    });
    if (error && (error as { type?: string }).type !== "resource_already_exists") {
      throw new Error(`Failed to set the ${product.cycle} Test Store price.`);
    }
  }

  const premiumEntitlement = entitlementsData.items.find(
    (item) => item.lookup_key === "premium",
  );
  if (!premiumEntitlement) throw new Error('The "premium" entitlement was not found.');
  const allPremiumProductIds = Object.values(premiumProducts).flat().map((item) => item.id);
  const { error: entitlementError } = await attachProductsToEntitlement({
    client,
    path: { project_id: projectId, entitlement_id: premiumEntitlement.id },
    body: { product_ids: allPremiumProductIds },
  });
  if (
    entitlementError &&
    (entitlementError as { type?: string }).type !== "unprocessable_entity_error"
  ) {
    throw new Error("Failed to attach the Premium products to the entitlement.");
  }

  const premiumOffering = offeringsData.items.find((item) => item.lookup_key === "premium");
  if (!premiumOffering) throw new Error('The "premium" offering was not found.');
  const { data: packageData, error: packagesError } = await listPackages({
    client,
    path: { project_id: projectId, offering_id: premiumOffering.id },
    query: { limit: 100 },
  });
  if (packagesError) throw new Error("Failed to load Premium packages.");

  for (const product of PRODUCTS) {
    const pkg = packageData.items.find(
      (item): item is Package => item.lookup_key === product.packageKey,
    );
    if (!pkg) throw new Error(`Package ${product.packageKey} was not found.`);

    const attachedIds = (pkg.products?.items ?? []).map((item) => item.product.id);
    const nextIds = premiumProducts[product.packageKey]!.map((item) => item.id);
    const oldIds = attachedIds.filter((id) => !nextIds.includes(id));
    if (oldIds.length > 0) {
      const { error } = await detachProductsFromPackage({
        client,
        path: { project_id: projectId, package_id: pkg.id },
        body: { product_ids: oldIds },
      });
      if (error) throw new Error(`Failed to detach old products from ${product.packageKey}.`);
    }
    const { error } = await attachProductsToPackage({
      client,
      path: { project_id: projectId, package_id: pkg.id },
      body: {
        products: nextIds.map((productId) => ({
          product_id: productId,
          eligibility_criteria: "all" as const,
        })),
      },
    });
    if (
      error &&
      (error as { type?: string }).type !== "unprocessable_entity_error"
    ) {
      throw new Error(`Failed to attach products to ${product.packageKey}.`);
    }
  }

  if (!premiumOffering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: projectId, offering_id: premiumOffering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to make Premium the current offering.");
  }

  console.log("RevenueCat now uses Rook Premium as the current monthly/yearly offering.");
  console.log("Only the current Premium products are configured.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});