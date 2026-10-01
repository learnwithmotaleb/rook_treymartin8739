import assert from "node:assert/strict";
import { test } from "node:test";
import { GetReviewerDemoResponse } from "@workspace/api-zod";
import { REVIEWER_DEMO_NOT_AUTHORIZED_RESPONSE } from "../routes/reviewerDemo";
import { buildReviewerDemoPayload } from "./reviewerDemoFixtures";
import { getReviewerDemoPayloadForUser } from "./reviewerDemoService";
import { REVIEWER_PHOTO_URL } from "./reviewerPhotoFixture";

const SHIPPED_PLATFORMS = [
  "instagram",
  "facebook",
  "x",
];

test("reviewer demo access is delegated to the server reviewer check", async () => {
  const checkedUsers: string[] = [];
  const denied = await getReviewerDemoPayloadForUser("ordinary-user", async (userId) => {
    checkedUsers.push(userId);
    return false;
  });

  assert.deepEqual(checkedUsers, ["ordinary-user"]);
  assert.equal(denied, null);

  const allowed = await getReviewerDemoPayloadForUser("reviewer-user", async (userId) => {
    checkedUsers.push(userId);
    return userId === "reviewer-user";
  });
  assert.equal(allowed?.mode, "reviewer_demo");
  assert.deepEqual(checkedUsers, ["ordinary-user", "reviewer-user"]);
});

test("normal authenticated reviewer-demo decisions have an explicit live-mode response", () => {
  assert.deepEqual(REVIEWER_DEMO_NOT_AUTHORIZED_RESPONSE, {
    error: "reviewer_demo_not_authorized",
    mode: "live",
  });
});

test("fixture uses synthetic, unverified accounts only for shipped connection platforms", () => {
  const payload = buildReviewerDemoPayload(new Date("2026-10-01T12:00:00.000Z"));

  assert.equal(payload.version, 1);
  assert.equal(payload.mode, "reviewer_demo");
  assert.equal(payload.isSample, true);
  assert.equal(payload.actions, "local_preview_only");
  assert.deepEqual(payload.accounts.map((account) => account.platform), SHIPPED_PLATFORMS);
  assert.equal(payload.accounts.length, SHIPPED_PLATFORMS.length);
  for (const account of payload.accounts) {
    assert.match(account.id, /^review-demo-/);
    assert.equal(account.verified, false);
    assert.equal(account.connectionType, "demo");
    assert.equal(account.isSample, true);
    assert.equal(account.profileUrl, null);
    assert.match(account.username, /demo|fictional/i);
  }
});

test("fixture validates against the generated API response schema", () => {
  const payload = buildReviewerDemoPayload(new Date("2026-10-01T12:00:00.000Z"));
  assert.doesNotThrow(() => GetReviewerDemoResponse.parse(payload));
});

test("fixture media and threat photo evidence use only the canonical reviewer photo", () => {
  const payload = buildReviewerDemoPayload(new Date("2026-10-01T12:00:00.000Z"));

  assert.deepEqual(Object.keys(payload.mediaByAccount), payload.accounts.map((account) => account.id));
  for (const media of Object.values(payload.mediaByAccount)) {
    assert.equal(media.isSample, true);
    assert.equal(media.hasAccess, true);
    assert.ok(media.items.length > 0);
    for (const item of media.items) {
      assert.match(item.id, /^review-demo-/);
      assert.equal(item.url, REVIEWER_PHOTO_URL);
      assert.equal(item.thumbnailUrl, REVIEWER_PHOTO_URL);
    }
  }

  for (const threat of payload.threats) {
    assert.match(threat.id, /^review-demo-threat-/);
    assert.equal(threat.isSample, true);
    assert.equal(threat.profileUrl, null);
    if (threat.suspiciousUsername) assert.match(threat.suspiciousUsername, /^fictional_/);
    for (const evidence of threat.evidence) {
      const photoEvidence = evidence as Record<string, unknown>;
      if (photoEvidence["yourPhotoUrl"] || photoEvidence["stolenPhotoUrl"]) {
        assert.equal(photoEvidence["yourPhotoUrl"], REVIEWER_PHOTO_URL);
        assert.equal(photoEvidence["stolenPhotoUrl"], REVIEWER_PHOTO_URL);
      }
    }
  }
  const confidenceSample = payload.threats.find((threat) => threat.id === "review-demo-threat-01");
  assert.ok(confidenceSample);
  assert.equal(confidenceSample.isSample, true);
  assert.equal(confidenceSample.postDatingDays, 14);
  assert.ok(confidenceSample.detectedSignals.includes("firstScanHighConfidence"));
  assert.ok(payload.threats.some((threat) => threat.resolved));
  assert.equal(payload.latestScan.status, "completed");
  assert.equal(payload.latestScan.isSample, true);
});

test("fixture exposes dashboard statistics only and preview limits match the Free plan", () => {
  const payload = buildReviewerDemoPayload(new Date("2026-10-01T12:00:00.000Z"));

  assert.deepEqual(Object.keys(payload.profileSummary), [
    "securityScore",
    "scoreTrend",
    "monitored",
    "lastScan",
    "totalPhotosIndexed",
    "totalCaptionsIndexed",
    "reelsIndexed",
    "fingerprintUpdated",
    "isSample",
  ]);
  assert.equal(payload.quota.isSample, true);
  assert.equal(payload.quota.tier, "free");
  assert.equal(payload.quota.scansAllowed, 1);
  assert.equal(payload.quota.scansUsed, 1);
  assert.equal(payload.quota.imagesPerScan, 1);
  assert.equal(payload.quota.canScan, false);
  assert.equal(payload.consent.isSample, true);
  assert.match(payload.notice, /Sample consent is not real consent/);
  assert.equal(payload.profileSummary.isSample, true);
  assert.equal(payload.profileSummary.monitored, 3);
  assert.equal(payload.identityBadge.isSample, true);
  assert.equal(payload.identityBadge.confidenceTier, "UNVERIFIED");
  assert.equal(payload.identityBadge.verifiedPlatformCount, 0);
  assert.deepEqual(payload.identityBadge.verifiedPlatforms, []);
  assert.match(payload.identityBadge.badge.label, /^Sample/);
  assert.match(payload.identityBadge.badge.description, /OAuth-verified/i);

  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /accessToken|clerkId|email|secret/i);
});