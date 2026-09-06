import { listWebhookIntegrations } from "@replit/revenuecat-sdk";

import { getUncachableRevenueCatClient } from "./revenueCatClient";

async function run() {
  const projectId = process.env["REVENUECAT_PROJECT_ID"];
  if (!projectId) throw new Error("REVENUECAT_PROJECT_ID is not configured.");

  const client = await getUncachableRevenueCatClient();
  const { data, error } = await listWebhookIntegrations({
    client,
    path: { project_id: projectId },
    query: { limit: 100 },
  });
  if (error) {
    throw new Error(`Failed to list RevenueCat webhooks: ${JSON.stringify(error)}`);
  }

  console.log(JSON.stringify(
    (data.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      url: item.url,
      isSandbox: item.is_sandbox,
      hasAuthorizationHeader: Boolean(item.authorization_header),
    })),
    null,
    2,
  ));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});