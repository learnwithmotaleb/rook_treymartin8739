import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldSkipReviewerBackgroundWork } from "./backgroundReviewerGuard";

test("background reviewer guard skips designated users but preserves ordinary users", async () => {
  assert.equal(
    await shouldSkipReviewerBackgroundWork("reviewer", async () => true),
    true,
  );
  assert.equal(
    await shouldSkipReviewerBackgroundWork("ordinary-user", async () => false),
    false,
  );
});

test("background reviewer guard fails closed when trusted designation is unavailable", async () => {
  assert.equal(
    await shouldSkipReviewerBackgroundWork("unknown-user", async () => {
      throw new Error("identity lookup unavailable");
    }),
    true,
  );
});