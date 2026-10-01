import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import {
  createReviewerDemoMutationGuard,
  isReviewerDemoGuardedOperation,
} from "./reviewerDemoMutationGuard";
import {
  createClerkReviewerEmailLookup,
  createReviewerDesignationChecker,
} from "../services/reviewerService";

test("guard covers reviewer mutations and provider-backed processing", () => {
  for (const [method, path] of [
    ["POST", "/scan"],
    ["POST", "/photos/search"],
    ["GET", "/accounts/account-1/media"],
    ["POST", "/accounts"],
    ["PATCH", "/accounts/account-1"],
    ["POST", "/accounts/refresh"],
    ["DELETE", "/accounts/account-1"],
    ["PATCH", "/threats/threat-1/resolve"],
    ["PATCH", "/threats/bulk-resolve"],
    ["PATCH", "/me"],
    ["DELETE", "/me"],
    ["POST", "/me/onboarding"],
    ["DELETE", "/me/photo-data"],
    ["PATCH", "/notifications/token"],
    ["POST", "/identity/verify-account"],
    ["GET", "/identity/profile"],
    ["POST", "/ai/analyze-scam"],
    ["POST", "/v1/scans"],
    ["POST", "/oauth/state"],
    ["POST", "/oauth/x/init"],
  ]) {
    assert.equal(isReviewerDemoGuardedOperation(method, path), true, `${method} ${path}`);
  }
});

test("guard explicitly preserves legal acknowledgements, billing sync, and reads", () => {
  for (const [method, path] of [
    ["POST", "/me/terms"],
    ["POST", "/me/age-confirm"],
    ["POST", "/billing/revenuecat-sync"],
    ["GET", "/me"],
    ["GET", "/legal/terms"],
    ["GET", "/me/export"],
    ["GET", "/billing/subscription"],
    ["GET", "/identity/badge"],
    ["GET", "/accounts"],
    ["GET", "/threats"],
  ]) {
    assert.equal(isReviewerDemoGuardedOperation(method, path), false, `${method} ${path}`);
  }
  assert.equal(isReviewerDemoGuardedOperation("GET", "/reviewer/demo"), false);
});

test("GET /me remains available for reviewer startup bootstrap", async () => {
  const req = mockRequest("GET", "/me");
  const res = mockResponse();
  let nextCalled = false;
  const guard = createReviewerDemoMutationGuard(async () => {
    throw new Error("GET /me must not be rejected by the mutation guard");
  });

  await guard(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(isReviewerDemoGuardedOperation("GET", "/me"), false);
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, undefined);
});

test("API-key v1 scans guard checks the authenticated key owner, not request body identity", async () => {
  const req = {
    method: "POST",
    path: "/v1/scans",
    apiKeyUserId: "reviewer-api-key-owner",
    body: { userId: "ordinary-user" },
    log: { error() {} },
  } as unknown as Request;
  const res = mockResponse();
  let nextCalled = false;
  const guard = createReviewerDemoMutationGuard(async (userId, clerkId) => {
    assert.equal(userId, "reviewer-api-key-owner");
    assert.equal(clerkId, undefined);
    return true;
  });

  await guard(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    error: "reviewer_demo_preview_only",
    message: "This operation is unavailable in reviewer demo preview.",
  });
});

test("reviewer onboarding answers are rejected without persisting request data", async () => {
  const req = {
    ...mockRequest("POST", "/me/onboarding"),
    body: { answers: { fullName: "Real identity data", socialHandles: ["private-handle"] } },
  } as unknown as Request;
  const res = mockResponse();
  let nextCalled = false;
  const guard = createReviewerDemoMutationGuard(async () => true);

  await guard(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 409);

  let ordinaryNextCalled = false;
  await createReviewerDemoMutationGuard(async () => false)(
    req,
    mockResponse(),
    (() => {
      ordinaryNextCalled = true;
    }) as NextFunction,
  );
  assert.equal(ordinaryNextCalled, true);
});

function mockRequest(method: string, path: string): Request {
  return {
    method,
    path,
    userId: "local-user",
    clerkId: "user_ordinary",
    log: { error() {} },
  } as unknown as Request;
}

function mockResponse(): Response & { statusCode?: number; body?: unknown } {
  const response: Record<string, unknown> = {};
  response["status"] = (statusCode: number) => {
    response["statusCode"] = statusCode;
    return response;
  };
  response["json"] = (body: unknown) => {
    response["body"] = body;
    return response;
  };
  return response as unknown as Response & { statusCode?: number; body?: unknown };
}

test("reviewer mutations get 409 while ordinary users continue normally", async () => {
  const reviewerReq = mockRequest("POST", "/scan");
  const reviewerRes = mockResponse();
  let reviewerNextCalled = false;
  const reviewerGuard = createReviewerDemoMutationGuard(async (userId, clerkId) => {
    assert.equal(userId, "local-user");
    assert.equal(clerkId, "user_ordinary");
    return true;
  });
  await reviewerGuard(reviewerReq, reviewerRes, (() => {
    reviewerNextCalled = true;
  }) as NextFunction);

  assert.equal(reviewerNextCalled, false);
  assert.equal(reviewerRes.statusCode, 409);
  assert.deepEqual(reviewerRes.body, {
    error: "reviewer_demo_preview_only",
    message: "This operation is unavailable in reviewer demo preview.",
  });

  const ordinaryReq = mockRequest("POST", "/scan");
  const ordinaryRes = mockResponse();
  let ordinaryNextCalled = false;
  const ordinaryGuard = createReviewerDemoMutationGuard(async () => false);
  await ordinaryGuard(ordinaryReq, ordinaryRes, (() => {
    ordinaryNextCalled = true;
  }) as NextFunction);

  assert.equal(ordinaryNextCalled, true);
  assert.equal(ordinaryRes.statusCode, undefined);
});

test("reviewer guard fails closed if its designation check is unavailable", async () => {
  const req = mockRequest("POST", "/scan");
  const res = mockResponse();
  let nextCalled = false;
  const guard = createReviewerDemoMutationGuard(async () => {
    throw new Error("identity lookup unavailable");
  });
  await guard(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    error: "reviewer_guard_unavailable",
    message: "This operation is temporarily unavailable.",
  });
});

async function withReviewerConfig(
  config: { email?: string; userId?: string; legacyId?: string },
  run: () => Promise<void>,
): Promise<void> {
  const previous = {
    email: process.env["APP_REVIEW_EMAIL"],
    userId: process.env["APP_REVIEW_USER_ID"],
    legacyId: process.env["APP_REVIEW_CLERK_USER_ID"],
  };
  try {
    if (config.email === undefined) delete process.env["APP_REVIEW_EMAIL"];
    else process.env["APP_REVIEW_EMAIL"] = config.email;
    if (config.userId === undefined) delete process.env["APP_REVIEW_USER_ID"];
    else process.env["APP_REVIEW_USER_ID"] = config.userId;
    if (config.legacyId === undefined) delete process.env["APP_REVIEW_CLERK_USER_ID"];
    else process.env["APP_REVIEW_CLERK_USER_ID"] = config.legacyId;
    await run();
  } finally {
    if (previous.email === undefined) delete process.env["APP_REVIEW_EMAIL"];
    else process.env["APP_REVIEW_EMAIL"] = previous.email;
    if (previous.userId === undefined) delete process.env["APP_REVIEW_USER_ID"];
    else process.env["APP_REVIEW_USER_ID"] = previous.userId;
    if (previous.legacyId === undefined) delete process.env["APP_REVIEW_CLERK_USER_ID"];
    else process.env["APP_REVIEW_CLERK_USER_ID"] = previous.legacyId;
  }
}

test("a mutable local email cannot spoof configured email-mode reviewer identity", async () => {
  await withReviewerConfig({
    email: "reviewer@example.test",
    userId: "user_stale_static_id",
  }, async () => {
    const localUser = {
      clerkId: "user_mutable-email-owner",
      email: "reviewer@example.test",
    };
    let lookedUpEmail: string | undefined;
    const isReviewer = createReviewerDesignationChecker({
      getStoredClerkId: async (userId) => {
        assert.equal(userId, "local-user");
        return localUser.clerkId;
      },
      getClerkUsersByEmail: async (email) => {
        lookedUpEmail = email;
        return [{
          id: "user_actual_reviewer",
          primary_email_address_id: "primary",
          email_addresses: [{
            id: "primary",
            email_address: "reviewer@example.test",
            verification: { status: "verified" },
          }],
        }];
      },
    });

    assert.equal(await isReviewer("local-user", "user_mutable-email-owner"), false);
    assert.equal(lookedUpEmail, "reviewer@example.test");
  });
});

test("verified Clerk primary email matching the local Clerk ID designates despite a stale configured ID", async () => {
  await withReviewerConfig({
    email: "reviewer@example.test",
    userId: "user_stale_static_id",
  }, async () => {
    const isReviewer = createReviewerDesignationChecker({
      getStoredClerkId: async () => "user_fresh_email_identity",
      getClerkUsersByEmail: async () => [{
        id: "user_fresh_email_identity",
        primary_email_address_id: "primary-address",
        email_addresses: [{
          id: "primary-address",
          email_address: "Reviewer@Example.Test",
          verification: { status: "verified" },
        }],
      }],
    });

    assert.equal(await isReviewer("local-user", "user_fresh_email_identity"), true);
  });
});

test("email mode requires the matching verified primary email and matching local Clerk ID", async () => {
  await withReviewerConfig({
    email: "reviewer@example.test",
    userId: "user_reviewer",
  }, async () => {
    const unverifiedReviewer = createReviewerDesignationChecker({
      getStoredClerkId: async () => "user_reviewer",
      getClerkUsersByEmail: async () => [{
        id: "user_reviewer",
        primary_email_address_id: "primary-address",
        email_addresses: [{
          id: "primary-address",
          email_address: "reviewer@example.test",
          verification: { status: "unverified" },
        }],
      }],
    });
    assert.equal(await unverifiedReviewer("local-user", "user_reviewer"), false);

    const mismatchedLocalClerkId = createReviewerDesignationChecker({
      getStoredClerkId: async () => "user_other",
      getClerkUsersByEmail: async () => [{
        id: "user_reviewer",
        primary_email_address_id: "primary-address",
        email_addresses: [{
          id: "primary-address",
          email_address: "reviewer@example.test",
          verification: { status: "verified" },
        }],
      }],
    });
    assert.equal(await mismatchedLocalClerkId("local-user", "user_reviewer"), false);
  });
});

test("static Clerk ID remains the fallback only when reviewer email mode is unset", async () => {
  await withReviewerConfig({ userId: "user_fixed" }, async () => {
    const isReviewer = createReviewerDesignationChecker({
      getStoredClerkId: async () => "user_fixed",
      getClerkUsersByEmail: async () => {
        throw new Error("Static ID mode must not perform an email lookup");
      },
    });

    assert.equal(await isReviewer("local-user", "user_fixed"), true);
    assert.equal(await isReviewer("local-user", "user_other"), false);
  });
});

test("trusted Clerk email lookup caches verified results for a short TTL", async () => {
  let now = 0;
  let calls = 0;
  const lookup = createClerkReviewerEmailLookup(
    async (url, init) => {
      calls += 1;
      assert.equal(url, "https://api.clerk.com/v1/users?email_address=reviewer%40example.test&limit=2");
      assert.equal((init.headers as Record<string, string>)["Authorization"], "Bearer test-key");
      return new Response(JSON.stringify([{
        id: "user_cached",
        primary_email_address_id: "primary-address",
        email_addresses: [{
          id: "primary-address",
          email_address: "reviewer@example.test",
          verification: { status: "verified" },
        }],
      }]), { status: 200 });
    },
    () => "test-key",
    () => now,
    1_000,
  );

  await lookup("reviewer@example.test");
  await lookup("reviewer@example.test");
  assert.equal(calls, 1);
  now = 1_001;
  await lookup("reviewer@example.test");
  assert.equal(calls, 2);
});

test("a newly provisioned reviewer identity can invalidate a cached miss", async () => {
  let reviewerProvisioned = false;
  let calls = 0;
  const lookup = createClerkReviewerEmailLookup(
    async () => {
      calls += 1;
      const users = reviewerProvisioned
        ? [{
            id: "user_fresh_reviewer",
            primary_email_address_id: "primary-address",
            email_addresses: [{
              id: "primary-address",
              email_address: "reviewer@example.test",
              verification: { status: "verified" },
            }],
          }]
        : [];
      return new Response(JSON.stringify(users), { status: 200 });
    },
    () => "test-key",
  );

  assert.deepEqual(await lookup("reviewer@example.test"), []);
  reviewerProvisioned = true;
  assert.deepEqual(await lookup("reviewer@example.test"), []);
  lookup.invalidate("reviewer@example.test");
  assert.equal((await lookup("reviewer@example.test"))[0]?.id, "user_fresh_reviewer");
  assert.equal(calls, 2);
});