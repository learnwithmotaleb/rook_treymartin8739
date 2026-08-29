import {
  deleteEntitlement,
  deleteOffering,
  deletePackageFromOffering,
  deleteProduct,
  detachProductsFromEntitlement,
  detachProductsFromPackage,
  listEntitlements,
  listOfferings,
  listPackages,
  listProducts,
} from "@replit/revenuecat-sdk";

import { getUncachableRevenueCatClient } from "./revenueCatClient";

const CURRENT_STORE_IDENTIFIERS = new Set([
  "premium_monthly_v2",
  "premium_annual_v2",
  "premium_monthly_v2:monthly",
  "premium_annual_v2:annual",
]);

async function run() {
  const projectId = process.env["REVENUECAT_PROJECT_ID"];
  if (!projectId) throw new Error("REVENUECAT_PROJECT_ID is not configured.");

  const client = await getUncachableRevenueCatClient();
  const [
    { data: products, error: productsError },
    { data: entitlements, error: entitlementsError },
    { data: offerings, error: offeringsError },
  ] = await Promise.all([
    listProducts({ client, path: { project_id: projectId }, query: { limit: 100 } }),
    listEntitlements({ client, path: { project_id: projectId }, query: { limit: 100 } }),
    listOfferings({ client, path: { project_id: projectId }, query: { limit: 100 } }),
  ]);
  if (productsError || entitlementsError || offeringsError) {
    throw new Error("Failed to load the live RevenueCat catalog.");
  }

  const currentProducts = (products.items ?? []).filter((product) =>
    CURRENT_STORE_IDENTIFIERS.has(product.store_identifier),
  );
  const oldProducts = (products.items ?? []).filter(
    (product) => !CURRENT_STORE_IDENTIFIERS.has(product.store_identifier),
  );
  const oldProductIds = oldProducts.map((product) => product.id);

  for (const entitlement of entitlements.items ?? []) {
    if (oldProductIds.length === 0) continue;
    const { error } = await detachProductsFromEntitlement({
      client,
      path: { project_id: projectId, entitlement_id: entitlement.id },
      body: { product_ids: oldProductIds },
    });
    if (error && (error as { type?: string }).type !== "unprocessable_entity_error") {
      throw new Error(`Failed to detach old products from ${entitlement.lookup_key}.`);
    }
  }

  for (const offering of offerings.items ?? []) {
    const { data: packages, error: packagesError } = await listPackages({
      client,
      path: { project_id: projectId, offering_id: offering.id },
      query: { limit: 100 },
    });
    if (packagesError) throw new Error(`Failed to inspect ${offering.lookup_key} packages.`);

    for (const pkg of packages.items ?? []) {
      const attachedOldIds = (pkg.products?.items ?? [])
        .map((association) => association.product.id)
        .filter((id) => oldProductIds.includes(id));
      if (attachedOldIds.length > 0) {
        const { error } = await detachProductsFromPackage({
          client,
          path: { project_id: projectId, package_id: pkg.id },
          body: { product_ids: attachedOldIds },
        });
        if (error) throw new Error(`Failed to detach old products from ${pkg.lookup_key}.`);
      }
      if (offering.lookup_key !== "premium") {
        const { error } = await deletePackageFromOffering({
          client,
          path: { project_id: projectId, package_id: pkg.id },
        });
        if (error) throw new Error(`Failed to delete ${offering.lookup_key}/${pkg.lookup_key}.`);
      }
    }

    if (offering.lookup_key !== "premium") {
      const { error } = await deleteOffering({
        client,
        path: { project_id: projectId, offering_id: offering.id },
      });
      if (error) throw new Error(`Failed to delete ${offering.lookup_key} offering.`);
    }
  }

  for (const entitlement of entitlements.items ?? []) {
    if (entitlement.lookup_key !== "premium") {
      const { error } = await deleteEntitlement({
        client,
        path: { project_id: projectId, entitlement_id: entitlement.id },
      });
      if (error) throw new Error(`Failed to delete ${entitlement.lookup_key} entitlement.`);
    }
  }

  for (const product of oldProducts) {
    const { error } = await deleteProduct({
      client,
      path: { project_id: projectId, product_id: product.id },
    });
    if (error) throw new Error(`Failed to delete product ${product.store_identifier}.`);
  }

  console.log(`Deleted ${oldProducts.length} legacy products.`);
  console.log(`Preserved ${currentProducts.length} current Premium products.`);
  console.log("Preserved the current premium offering and entitlement.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});