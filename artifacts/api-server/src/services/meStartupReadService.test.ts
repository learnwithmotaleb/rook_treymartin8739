import assert from "node:assert/strict";
import { test } from "node:test";
import { getMeStartupFields } from "./meStartupReadService";

test("reviewer GET /me fields use stored values without creating subscriptions or recalculating scores", async () => {
  const calls: string[] = [];
  const fields = await getMeStartupFields(
    "reviewer-user",
    true,
    68,
    {
      getStoredSubscriptionTier: async (userId) => {
        calls.push(`stored-tier:${userId}`);
        return null;
      },
      getSubscription: async () => {
        calls.push("get-subscription");
        throw new Error("Reviewer bootstrap must not create a subscription");
      },
      recalculateScore: async () => {
        calls.push("recalculate-score");
        throw new Error("Reviewer bootstrap must not persist score enrichment");
      },
    },
  );

  assert.deepEqual(fields, { tier: "free", securityScore: 68 });
  assert.deepEqual(calls, ["stored-tier:reviewer-user"]);
});

test("ordinary GET /me keeps existing subscription and score enrichment", async () => {
  const calls: string[] = [];
  const fields = await getMeStartupFields(
    "ordinary-user",
    false,
    68,
    {
      getStoredSubscriptionTier: async () => {
        calls.push("stored-tier");
        return null;
      },
      getSubscription: async (userId) => {
        calls.push(`get-subscription:${userId}`);
        return { tier: "pro" };
      },
      recalculateScore: async (userId) => {
        calls.push(`recalculate-score:${userId}`);
        return 76;
      },
    },
  );

  assert.deepEqual(fields, { tier: "pro", securityScore: 76 });
  assert.deepEqual(calls, ["get-subscription:ordinary-user", "recalculate-score:ordinary-user"]);
});