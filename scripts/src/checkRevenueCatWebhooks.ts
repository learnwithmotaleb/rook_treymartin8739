import {
  createWebhookIntegration,
  listWebhookIntegrations,
} from "@replit/revenuecat-sdk";

import { getUncachableRevenueCatClient } from "./revenueCatClient";

async function run() {
  const projectId = process.env["REVENUECAT_PROJECT_ID"];
  if (!projectId) throw new Error("REVENUECAT_PROJECT_ID is not configured.");

  const client = await getUncachableRevenueCatClient();
  const readWebhooks = () => listWebhookIntegrations({
    client,
    path: { project_id: projectId },
    query: { limit: 100 },
  });

  let { data, error } = await readWebhooks();
  if (error || !data) {
    throw new Error(`Failed to list RevenueCat webhooks: ${JSON.stringify(error)}`);
  }

  const url = "https://tryrook.app/api/rc-webhook";
  let webhook = (data.items ?? []).find((item) => item.url === url);
  if (!webhook) {
    const secret = process.env["REVENUECAT_WEBHOOK_SECRET"];
    if (!secret) throw new Error("REVENUECAT_WEBHOOK_SECRET is not configured.");
    const { error: createError } = await createWebhookIntegration({
      client,
      path: { project_id: projectId },
      body: {
        name: "Rook Production API",
        url,
        authorization_header: `Bearer ${secret}`,
        environment: "production",
      },
    });
    if (createError) {
      throw new Error(`Failed to create RevenueCat webhook: ${JSON.stringify(createError)}`);
    }
    ({ data, error } = await readWebhooks());
    if (error || !data) throw new Error("Webhook created but verification failed.");
    webhook = (data.items ?? []).find((item) => item.url === url);
  }
  if (!webhook) throw new Error("RevenueCat webhook was not found after configuration.");

  console.log(JSON.stringify(
    (data.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      url: item.url,
      environment: item.environment,
      appId: item.app_id,
    })),
    null,
    2,
  ));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});