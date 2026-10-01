import assert from "node:assert/strict";
import test from "node:test";
import { retryStartupInitialization } from "./startupRetry.ts";

test("startup Retry re-arms its timeout and initializes with the current Clerk identity", () => {
  let timedOut = true;
  let retryAttempts = 0;
  const initialized = [];

  retryStartupInitialization({
    account: {
      userId: "current-clerk-user",
      name: "Current Clerk Name",
      email: "current@example.test",
    },
    clearTimedOut: () => { timedOut = false; },
    incrementRetryAttempt: () => { retryAttempts += 1; },
    initialize: (...args) => initialized.push(args),
  });

  assert.equal(timedOut, false);
  assert.equal(retryAttempts, 1);
  assert.deepEqual(initialized, [[
    "Current Clerk Name",
    "current@example.test",
    "current-clerk-user",
  ]]);
});

test("startup Retry re-arms the timeout without initializing a missing account", () => {
  let retryAttempts = 0;
  const initialized = [];
  retryStartupInitialization({
    account: { userId: null, name: "", email: "" },
    clearTimedOut: () => {},
    incrementRetryAttempt: () => { retryAttempts += 1; },
    initialize: (...args) => initialized.push(args),
  });
  assert.equal(retryAttempts, 1);
  assert.deepEqual(initialized, []);
});