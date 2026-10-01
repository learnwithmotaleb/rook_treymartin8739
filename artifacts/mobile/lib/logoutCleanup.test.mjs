import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPinnedPushTokenCleanupRequest,
  createPinnedPushTokenCleanup,
  shouldCaptureLiveLogoutCleanup,
} from "./logoutCleanup.ts";

test("old-account cleanup stays pinned to its captured bearer, never a later account credential", () => {
  const cleanup = createPinnedPushTokenCleanup(
    { ownerId: "account-a", bearerToken: "old-a-bearer" },
    { ownerId: "account-a", token: "ExpoPushToken[A-device]", platform: "ios" },
    "account-a",
  );
  assert.ok(cleanup);

  const currentAccountBearer = "account-b-bearer";
  const request = buildPinnedPushTokenCleanupRequest(cleanup);
  assert.equal(request.headers.Authorization, "Bearer old-a-bearer");
  assert.notEqual(request.headers.Authorization, `Bearer ${currentAccountBearer}`);
  assert.equal(
    createPinnedPushTokenCleanup(
      { ownerId: "account-a", bearerToken: "old-a-bearer" },
      { ownerId: "account-a", token: "ExpoPushToken[A-device]", platform: "ios" },
      "account-b",
    ),
    null,
  );
});

test("cleanup always targets only the exact captured device token", () => {
  const cleanup = createPinnedPushTokenCleanup(
    { ownerId: "account-a", bearerToken: "a-bearer" },
    { ownerId: "account-a", token: "ExpoPushToken[A-device]", platform: "android" },
    "account-a",
  );
  assert.ok(cleanup);
  const request = buildPinnedPushTokenCleanupRequest(cleanup);
  const query = new URLSearchParams(request.path.split("?")[1]);
  assert.equal(request.method, "DELETE");
  assert.equal(query.get("token"), "ExpoPushToken[A-device]");
  assert.deepEqual([...query.keys()], ["token"]);
  assert.equal(
    createPinnedPushTokenCleanup(
      { ownerId: "account-a", bearerToken: "a-bearer" },
      { ownerId: "account-a", token: " ", platform: "android" },
      "account-a",
    ),
    null,
  );
});

test("normal live logout cleanup is retained, while demo and account-delete cleanup are skipped", () => {
  assert.equal(shouldCaptureLiveLogoutCleanup({
    accountKey: "account-a",
    status: "live",
  }, "account-a", false), true);
  assert.equal(shouldCaptureLiveLogoutCleanup({
    accountKey: "account-a",
    status: "demo",
  }, "account-a", false), false);
  assert.equal(shouldCaptureLiveLogoutCleanup({
    accountKey: "account-a",
    status: "live",
  }, "account-a", true), false);
  assert.equal(shouldCaptureLiveLogoutCleanup({
    accountKey: "account-a",
    status: "live",
  }, "account-b", false), false);
});