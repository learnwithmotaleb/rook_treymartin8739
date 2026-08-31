import {
  createCustomer,
  getCustomer,
  grantCustomerEntitlement,
  listCustomerActiveEntitlements,
  listEntitlements,
} from "@replit/revenuecat-sdk";

import { getUncachableRevenueCatClient } from "./revenueCatClient";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function run() {
  const customerId = process.argv[2];
  if (!customerId) {
    throw new Error("Usage: grantReviewerPremium.ts <RevenueCat customer ID>");
  }

  const projectId = required("REVENUECAT_PROJECT_ID");
  const client = await getUncachableRevenueCatClient();

  const { error: customerError } = await getCustomer({
    client,
    path: { project_id: projectId, customer_id: customerId },
  });
  if (customerError) {
    const type = (customerError as { type?: string }).type;
    if (type !== "resource_missing") {
      throw new Error(`Failed to load the RevenueCat customer: ${JSON.stringify(customerError)}`);
    }
    const { error: createError } = await createCustomer({
      client,
      path: { project_id: projectId },
      body: { id: customerId },
    });
    if (createError) {
      throw new Error(`Failed to create the RevenueCat customer: ${JSON.stringify(createError)}`);
    }
  }

  const { data: entitlements, error: entitlementsError } = await listEntitlements({
    client,
    path: { project_id: projectId },
    query: { limit: 100 },
  });
  if (entitlementsError) {
    throw new Error(`Failed to load RevenueCat entitlements: ${JSON.stringify(entitlementsError)}`);
  }

  const premium = entitlements.items.find(
    (entitlement) => entitlement.lookup_key === "premium" && entitlement.state === "active",
  );
  if (!premium) throw new Error('The active "premium" entitlement was not found.');

  const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
  const { error: grantError } = await grantCustomerEntitlement({
    client,
    path: { project_id: projectId, customer_id: customerId },
    body: { entitlement_id: premium.id, expires_at: expiresAt },
  });
  if (grantError) {
    throw new Error(`Failed to grant Premium: ${JSON.stringify(grantError)}`);
  }

  const { data: active, error: activeError } = await listCustomerActiveEntitlements({
    client,
    path: { project_id: projectId, customer_id: customerId },
  });
  if (activeError) {
    throw new Error(`Premium was granted but verification failed: ${JSON.stringify(activeError)}`);
  }

  const verified = active.items.some((entitlement) => entitlement.entitlement_id === premium.id);
  if (!verified) throw new Error("RevenueCat did not return Premium as an active entitlement.");

  console.log(`Premium reviewer access is active until ${new Date(expiresAt).toISOString()}.`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});