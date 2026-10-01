import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  AccountSessionGuard,
  activateReviewerDemo,
  addReviewerDemoAccount,
  beginReviewerDemoAuthorization,
  classifyReviewerDemoAuthorizationResult,
  getReviewerDemoInfo,
  getReviewerDemoSnapshot,
  getReviewerDemoThreat,
  getReviewerDemoAuthorizationState,
  mapThreatSummaryHighConfidence,
  invalidateReviewerAuthorizationForOwnerChange,
  isReviewerDemoAuthorizationRevisionCurrent,
  isReviewerDemoActive,
  isReviewerDemoNetworkRequestAllowed,
  parseReviewerDemoInfo,
  removeReviewerDemoAccount,
  resetReviewerDemoSession,
  resolveReviewerDemoThreat,
  saveReviewerDemoOnboardingAnswers,
  setReviewerDemoInfoLoader,
  setReviewerDemoAuthorizationStatus,
  updateReviewerDemoAccount,
} from "./reviewerDemo.ts";

function fixture(label = "fictional sample") {
  const accounts = [
    {
      id: "review-demo-account-01",
      platform: "instagram",
      username: `@${label}_instagram`,
      displayName: `${label} Instagram`,
      followers: 12,
      verified: false,
      needsReconnect: false,
      photosIndexed: 84,
      captionsIndexed: 72,
      reelsIndexed: 18,
      lastSynced: null,
      connectionType: "demo",
      isSample: true,
    },
    {
      id: "review-demo-account-02",
      platform: "facebook",
      username: `${label}_facebook`,
      displayName: `${label} Facebook`,
      followers: 12,
      verified: false,
      needsReconnect: false,
      photosIndexed: 15,
      captionsIndexed: 6,
      reelsIndexed: 0,
      lastSynced: null,
      connectionType: "demo",
      isSample: true,
    },
    {
      id: "review-demo-account-03",
      platform: "x",
      username: `@${label}_x`,
      displayName: `${label} X`,
      followers: 12,
      verified: false,
      needsReconnect: false,
      photosIndexed: 31,
      captionsIndexed: 48,
      reelsIndexed: 0,
      lastSynced: null,
      connectionType: "demo",
      isSample: true,
    },
  ];
  const mediaByAccount = Object.fromEntries(accounts.map((account, index) => [
    account.id,
    {
      items: [{
        id: `review-demo-media-${index + 1}-01`,
        type: "image",
        url: "https://example.invalid/sample.jpg",
        thumbnailUrl: "https://example.invalid/sample.jpg",
        caption: label,
        postedAt: null,
      }, {
        id: `review-demo-media-${index + 1}-02`,
        type: "image",
        url: "https://example.invalid/sample-2.jpg",
        thumbnailUrl: "https://example.invalid/sample-2.jpg",
        caption: label,
        postedAt: null,
      }],
      hasAccess: true,
      isSample: true,
    },
  ]));

  return {
    version: 1,
    mode: "reviewer_demo",
    isSample: true,
    actions: "local_preview_only",
    notice: "Sample only.",
    accounts,
    mediaByAccount,
    threats: [{
      id: "review-demo-threat-01",
      isSample: true,
      scanJobId: "review-demo-scan-current",
      type: "impersonator",
      severity: "high",
      platform: "instagram",
      title: "Sample threat",
      description: "Fictional sample.",
      details: "Fictional sample.",
      aiExplanation: "Fictional sample.",
      threatScore: 90,
      suspiciousUsername: "fictional_user",
      profileUrl: null,
      matchedMediaCount: 1,
      evidence: [],
      scoreBreakdown: {
        mediaSimilarity: 0,
        contentReuse: 0,
        profileSimilarity: 0,
        bioSimilarity: 0,
        usernameSimilarity: 0,
        behavioral: 0,
      },
      accountMeta: null,
      detectedSignals: [],
      resolved: false,
      confirmedVictims: null,
      crossUserEscalation: false,
      postDatingDays: null,
      resolvedAt: null,
      resolveAction: null,
      isLocked: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    }],
    profileSummary: {
      securityScore: 84,
      scoreTrend: 3,
      monitored: 3,
      lastScan: "2 days ago",
      totalPhotosIndexed: 130,
      totalCaptionsIndexed: 126,
      reelsIndexed: 18,
      fingerprintUpdated: "2 days ago",
      isSample: true,
    },
    identityBadge: {
      confidenceTier: "MEDIUM",
      overallConfidence: 60,
      verifiedPlatformCount: 0,
      verifiedPlatforms: [],
      badge: {
        tier: "MEDIUM",
        label: "Sample badge",
        description: "Fictional badge.",
        color: "#9E9E9E",
      },
      isSample: true,
    },
    consent: { hasConsent: true, consentedAt: null, consentVersion: "v1", isSample: true },
    quota: {
      canScan: false,
      scansUsed: 1,
      scansAllowed: 1,
      tier: "free",
      message: null,
      isSample: true,
    },
    capabilities: [],
  };
}

test("bundled reviewer photo populates both comparison sides and media without changing server data", (t) => {
  t.after(() => resetReviewerDemoSession());
  const { uri } = JSON.parse(readFileSync(new URL("../assets/images/reviewer-sample-photo.json", import.meta.url), "utf8"));
  assert.ok(uri.startsWith("data:image/jpeg;base64,"));
  const bytes = Buffer.from(uri.split(",")[1], "base64");
  assert.equal(bytes.subarray(0, 2).toString("hex"), "ffd8");
  assert.equal(bytes.subarray(-2).toString("hex"), "ffd9");
  const original = fixture();
  original.threats[0].evidence = [
    { id: "photo-1", type: "profile_photo", similarity: 91, label: "Sample profile match", yourPhotoUrl: "https://example.invalid/old.jpg", stolenPhotoUrl: "https://example.invalid/old.jpg" },
    { id: "photo-2", type: "post_photo", similarity: 85, label: "Sample post match" },
    { id: "caption-1", type: "caption", similarity: 82, label: "Sample caption", yourCaption: "Original sample caption", stolenCaption: "Sample caption copy" },
  ];
  const before = JSON.stringify(original);
  beginReviewerDemoAuthorization("clerk-photo-owner");
  activateReviewerDemo(original, "different-owner", uri);
  assert.equal(getReviewerDemoSnapshot(), null);
  activateReviewerDemo(original, "clerk-photo-owner", uri);
  const snapshot = getReviewerDemoSnapshot();
  for (const evidence of snapshot.threats[0].evidence.slice(0, 2)) {
    assert.equal(evidence.yourPhotoUrl, uri);
    assert.equal(evidence.stolenPhotoUrl, uri);
  }
  assert.deepEqual(snapshot.threats[0].evidence[2], original.threats[0].evidence[2]);
  for (const media of Object.values(snapshot.mediaByAccount)) {
    for (const item of media.items) {
      assert.equal(item.url, uri);
      assert.equal(item.thumbnailUrl, uri);
    }
  }
  assert.equal(JSON.stringify(original), before);
  resetReviewerDemoSession();
  assert.equal(getReviewerDemoSnapshot(), null);
});

test("only a fully marked server payload can be activated as reviewer demo", () => {
  assert.ok(parseReviewerDemoInfo(fixture()));
  const unsafe = fixture();
  unsafe.accounts[0].verified = true;
  assert.equal(parseReviewerDemoInfo(unsafe), null);
  assert.equal(parseReviewerDemoInfo({ ...fixture(), actions: "mutations_enabled" }), null);

  const unsupportedPlatform = fixture();
  unsupportedPlatform.accounts[2].platform = "threads";
  assert.equal(parseReviewerDemoInfo(unsupportedPlatform), null);

  const malformedAccount = fixture();
  malformedAccount.accounts[0] = null;
  assert.equal(parseReviewerDemoInfo(malformedAccount), null);

  const inconsistentProfile = fixture();
  inconsistentProfile.profileSummary.totalPhotosIndexed += 1;
  assert.equal(parseReviewerDemoInfo(inconsistentProfile), null);

  const missingMedia = fixture();
  delete missingMedia.mediaByAccount["review-demo-account-02"];
  assert.equal(parseReviewerDemoInfo(missingMedia), null);

  const decorated = fixture();
  decorated.email = "reviewer@example.com";
  decorated.clerkId = "user_real_clerk_id";
  decorated.accounts[0].email = "reviewer@example.com";
  decorated.accounts[0].clerkId = "user_real_clerk_id";
  decorated.identityBadge.userId = "user_real_clerk_id";
  decorated.threats[0].email = "reviewer@example.com";
  decorated.mediaByAccount["review-demo-account-01"].privateProfile = {
    email: "reviewer@example.com",
  };
  const sanitized = parseReviewerDemoInfo(decorated);
  assert.ok(sanitized);
  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(serialized, /reviewer@example\.com|user_real_clerk_id|clerkId|privateProfile/);
  assert.equal("email" in sanitized, false);
  assert.equal("email" in sanitized.accounts[0], false);
  assert.equal("userId" in sanitized.identityBadge, false);

  beginReviewerDemoAuthorization("clerk-user-a");
  activateReviewerDemo(sanitized, "clerk-user-a");
  updateReviewerDemoAccount("review-demo-account-01", {
    email: "reviewer@example.com",
    accessToken: "sensitive-token",
    displayName: "Preview only",
  });
  assert.doesNotMatch(
    JSON.stringify(getReviewerDemoSnapshot()),
    /reviewer@example\.com|sensitive-token|clerkId|accessToken/,
  );
  resetReviewerDemoSession();
});

test("initial reviewer snapshot summary exposes only the designated high-confidence sample signal", () => {
  const info = parseReviewerDemoInfo(fixture("high-confidence-reviewer"));
  info.threats[0].detectedSignals.push("firstScanHighConfidence");
  beginReviewerDemoAuthorization("clerk-user-a");
  activateReviewerDemo(info, "clerk-user-a");

  const initialSummary = getReviewerDemoSnapshot().threats[0];
  assert.equal(
    mapThreatSummaryHighConfidence(
      initialSummary.isSample,
      undefined,
      initialSummary.detectedSignals,
    ),
    true,
  );
  assert.equal(
    mapThreatSummaryHighConfidence(true, true, ["ordinarySampleSignal"]),
    false,
  );
  assert.equal(
    mapThreatSummaryHighConfidence(false, true, ["firstScanHighConfidence"]),
    true,
  );
  assert.equal(mapThreatSummaryHighConfidence(false, false, []), false);

  resetReviewerDemoSession();
  assert.equal(
    mapThreatSummaryHighConfidence(
      initialSummary.isSample,
      undefined,
      initialSummary.detectedSignals,
    ),
    false,
  );
});

test("preview mutations are local and never invoke a network loader", async () => {
  let loaderCalls = 0;
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Network must not be used for local preview actions.");
  };
  setReviewerDemoInfoLoader(async () => {
    loaderCalls += 1;
    throw new Error("No fetch expected.");
  });
  beginReviewerDemoAuthorization("clerk-user-a");
  activateReviewerDemo(parseReviewerDemoInfo(fixture()), "clerk-user-a");

  resolveReviewerDemoThreat("review-demo-threat-01", "preview_resolved");
  addReviewerDemoAccount("x", "@local_sample");
  saveReviewerDemoOnboardingAnswers({ username: "fictional_local_answer" });

  assert.equal(getReviewerDemoThreat("review-demo-threat-01").resolved, true);
  assert.equal(getReviewerDemoSnapshot().accounts.length, 4);
  assert.doesNotMatch(JSON.stringify(getReviewerDemoSnapshot()), /fictional_local_answer/);
  assert.equal(loaderCalls, 0);
  assert.equal(fetchCalls, 0);
  assert.equal(await getReviewerDemoInfo(), null);
  assert.equal(loaderCalls, 1);

  globalThis.fetch = originalFetch;
  resetReviewerDemoSession();
});

test("reset and account change isolate all local demo action state", () => {
  const firstUser = parseReviewerDemoInfo(fixture("first-user"));
  const secondUser = parseReviewerDemoInfo(fixture("second-user"));
  beginReviewerDemoAuthorization("clerk-user-a");
  activateReviewerDemo(firstUser, "clerk-user-a");
  resolveReviewerDemoThreat("review-demo-threat-01");
  addReviewerDemoAccount("x", "@first_user_only");
  beginReviewerDemoAuthorization("clerk-user-b");
  activateReviewerDemo(secondUser, "clerk-user-b");
  const snapshot = getReviewerDemoSnapshot();
  assert.equal(snapshot.accounts.length, 3);
  assert.equal(snapshot.accounts[0].username, "@second-user_instagram");
  assert.equal(snapshot.threats[0].resolved, false);
  resetReviewerDemoSession();
});

test("refreshing the same authorized account preserves in-session preview actions", () => {
  const first = parseReviewerDemoInfo(fixture("same-account"));
  beginReviewerDemoAuthorization("clerk-user-a");
  activateReviewerDemo(first, "clerk-user-a");
  resolveReviewerDemoThreat("review-demo-threat-01");
  activateReviewerDemo(parseReviewerDemoInfo(fixture("fresh-server-copy")), "clerk-user-a");
  assert.equal(getReviewerDemoSnapshot().accounts[0].username, "@same-account_instagram");
  assert.equal(getReviewerDemoThreat("review-demo-threat-01").resolved, true);
  resetReviewerDemoSession();
});

test("same-owner getter replacement preserves reviewer phase/actions; a real owner change invalidates them", () => {
  beginReviewerDemoAuthorization("clerk-user-a");
  activateReviewerDemo(parseReviewerDemoInfo(fixture("same-owner")), "clerk-user-a");
  resolveReviewerDemoThreat("review-demo-threat-01");
  const revision = getReviewerDemoAuthorizationState().revision;

  assert.equal(
    invalidateReviewerAuthorizationForOwnerChange("clerk-user-a", "clerk-user-a"),
    false,
  );
  assert.equal(isReviewerDemoActive(), true);
  assert.equal(getReviewerDemoAuthorizationState().status, "demo");
  assert.equal(getReviewerDemoAuthorizationState().revision, revision);
  assert.equal(getReviewerDemoThreat("review-demo-threat-01").resolved, true);

  assert.equal(
    invalidateReviewerAuthorizationForOwnerChange("clerk-user-a", "clerk-user-b"),
    true,
  );
  assert.equal(isReviewerDemoActive(), false);
  assert.equal(getReviewerDemoAuthorizationState().accountKey, "clerk-user-a");
  assert.equal(getReviewerDemoAuthorizationState().status, "pending");
  resetReviewerDemoSession();
});

test("preview account changes keep profile counters and media ownership aligned", () => {
  beginReviewerDemoAuthorization("clerk-user-a");
  activateReviewerDemo(parseReviewerDemoInfo(fixture()), "clerk-user-a");
  removeReviewerDemoAccount("review-demo-account-02");
  const snapshot = getReviewerDemoSnapshot();

  assert.equal(snapshot.profileSummary.monitored, 2);
  assert.equal(snapshot.profileSummary.totalPhotosIndexed, 115);
  assert.equal(snapshot.profileSummary.totalCaptionsIndexed, 120);
  assert.equal(snapshot.profileSummary.reelsIndexed, 18);
  assert.deepEqual(Object.keys(snapshot.mediaByAccount), snapshot.accounts.map((account) => account.id));
  resetReviewerDemoSession();
});

test("startup authorization fails closed except for the explicit reviewer-denied 404", () => {
  assert.equal(classifyReviewerDemoAuthorizationResult({
    kind: "payload",
    payload: fixture(),
  }).status, "demo");
  assert.equal(classifyReviewerDemoAuthorizationResult({
    kind: "http",
    statusCode: 404,
    errorCode: "reviewer_demo_not_authorized",
  }).status, "live");
  assert.equal(classifyReviewerDemoAuthorizationResult({
    kind: "http",
    statusCode: 404,
    errorCode: "not_found",
  }).status, "unavailable");
  assert.equal(classifyReviewerDemoAuthorizationResult({
    kind: "http",
    statusCode: 503,
    errorCode: "service_unavailable",
  }).status, "unavailable");
  assert.equal(classifyReviewerDemoAuthorizationResult({ kind: "network" }).status, "unavailable");
  assert.equal(classifyReviewerDemoAuthorizationResult({
    kind: "payload",
    payload: { ...fixture(), version: 2 },
  }).status, "unavailable");
});

test("bootstrap and actual legal/purchase requests are allowlisted while product requests fail closed", () => {
  assert.equal(isReviewerDemoNetworkRequestAllowed("pending", "/me", "GET"), true);
  assert.equal(isReviewerDemoNetworkRequestAllowed("pending", "/accounts", "GET"), false);
  assert.equal(isReviewerDemoNetworkRequestAllowed("pending", "/me/terms", "POST"), true);
  assert.equal(isReviewerDemoNetworkRequestAllowed("pending", "/billing/revenuecat-sync", "POST"), true);
  assert.equal(isReviewerDemoNetworkRequestAllowed("unavailable", "/scan", "POST"), false);
  assert.equal(isReviewerDemoNetworkRequestAllowed("demo", "/billing/subscription", "GET"), true);
  assert.equal(isReviewerDemoNetworkRequestAllowed("demo", "/me/photo-consent", "DELETE"), true);
  assert.equal(isReviewerDemoNetworkRequestAllowed("demo", "/accounts/refresh", "POST"), false);
  assert.equal(isReviewerDemoNetworkRequestAllowed("demo", "/unknown-product-write", "POST"), false);
  assert.equal(isReviewerDemoNetworkRequestAllowed("live", "/accounts", "GET"), true);
});

test("authorization state is account-scoped and stale login continuations are invalidated", async () => {
  beginReviewerDemoAuthorization("clerk-user-a");
  const pendingRevision = getReviewerDemoAuthorizationState().revision;
  assert.equal(setReviewerDemoAuthorizationStatus("clerk-user-b", "live"), false);
  assert.equal(setReviewerDemoAuthorizationStatus("clerk-user-a", "live"), true);
  assert.equal(isReviewerDemoAuthorizationRevisionCurrent(pendingRevision), false);
  beginReviewerDemoAuthorization("clerk-user-a");
  const guard = new AccountSessionGuard();
  const firstGeneration = guard.begin("clerk-user-a");
  let releaseOldLogin;
  const oldLogin = new Promise((resolve) => { releaseOldLogin = resolve; });
  const sideEffects = [];
  const staleContinuation = oldLogin.then(() => {
    if (guard.isCurrent(firstGeneration, "clerk-user-a")) sideEffects.push("old-account");
  });

  guard.begin("clerk-user-b");
  assert.equal(guard.isCurrent(firstGeneration, "clerk-user-a"), false);
  assert.equal(getReviewerDemoAuthorizationState().accountKey, "clerk-user-a");
  releaseOldLogin();
  await staleContinuation;
  assert.deepEqual(sideEffects, []);

  const secondGeneration = guard.begin("clerk-user-b");
  guard.invalidate();
  assert.equal(guard.isCurrent(secondGeneration, "clerk-user-b"), false);
  assert.equal(getReviewerDemoAuthorizationState().status, "pending");
});