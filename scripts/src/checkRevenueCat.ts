import {
  listEntitlements,
  listOfferings,
  listPackages,
  listProducts,
} from "@replit/revenuecat-sdk";

import { getUncachableRevenueCatClient } from "./revenueCatClient";

async function run() {
  const projectId = process.env["REVENUECAT_PROJECT_ID"];
  if (!projectId) throw new Error("REVENUECAT_PROJECT_ID is not configured.");

  const client = await getUncachableRevenueCatClient();
  const [
    { data: products, error: productsError },
    { data: entitlements, error: entitlementsError },
    { data: offerings, error: offeringsError },
  ] = await Promise.all([
    listProducts({
      client,
      path: { project_id: projectId },
      query: { limit: 100 },
    }),
    listEntitlements({
      client,
      path: { project_id: projectId },
      query: { limit: 100 },
    }),
    listOfferings({
      client,
      path: { project_id: projectId },
      query: { limit: 100 },
    }),
  ]);

  if (productsError || entitlementsError || offeringsError) {
    throw new Error("Failed to read the current RevenueCat catalog.");
  }

  const packageRows = [];
  for (const offering of offerings.items ?? []) {
    const { data: packages, error } = await listPackages({
      client,
      path: { project_id: projectId, offering_id: offering.id },
      query: { limit: 100 },
    });
    if (error) throw new Error(`Failed to list packages for ${offering.lookup_key}.`);
    packageRows.push({
      offering: offering.lookup_key,
      current: offering.is_current,
      packages: (packages.items ?? []).map((pkg) => ({
        lookupKey: pkg.lookup_key,
        id: pkg.id,
      })),
    });
  }

  console.log(JSON.stringify({
    products: (products.items ?? []).map((product) => ({
      id: product.id,
      appId: product.app_id,
      storeIdentifier: product.store_identifier,
      type: product.type,
      displayName: product.display_name,
    })),
    entitlements: (entitlements.items ?? []).map((entitlement) => ({
      id: entitlement.id,
      lookupKey: entitlement.lookup_key,
      displayName: entitlement.display_name,
    })),
    offerings: packageRows,
  }, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});