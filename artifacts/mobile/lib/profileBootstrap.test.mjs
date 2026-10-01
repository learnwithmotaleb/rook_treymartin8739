import assert from "node:assert/strict";
import test from "node:test";
import {
  isUsableProfile,
  normalizeNullProfileEmail,
} from "./profileBootstrap.ts";

function validProfile(overrides = {}) {
  return {
    id: "profile-id",
    name: "Display Name",
    email: null,
    username: "display",
    avatarInitials: "DN",
    tier: "free",
    securityScore: 0,
    scoreTrend: 0,
    monitored: 0,
    onboardingCompleted: false,
    lastScan: "Never",
    totalPhotosIndexed: 0,
    totalCaptionsIndexed: 0,
    reelsIndexed: 0,
    fingerprintUpdated: "Never",
    termsVersion: null,
    termsAcceptedAt: null,
    ageConfirmedAt: null,
    minimumAgeVersion: null,
    avatarUrl: null,
    ...overrides,
  };
}

test("legacy null display email normalizes and permits reviewer-mode authorization", () => {
  const profile = normalizeNullProfileEmail(validProfile());
  assert.equal(profile.email, "");
  assert.equal(isUsableProfile(profile), true);

  let reviewerModeEndpointCalls = 0;
  if (isUsableProfile(profile)) reviewerModeEndpointCalls += 1;
  assert.equal(reviewerModeEndpointCalls, 1);
});

test("profile bootstrap still rejects malformed identities and non-null malformed email values", () => {
  const malformedIdentity = normalizeNullProfileEmail(validProfile({ id: "" }));
  assert.equal(isUsableProfile(malformedIdentity), false);

  const malformedTier = normalizeNullProfileEmail(validProfile({ tier: "enterprise" }));
  assert.equal(isUsableProfile(malformedTier), false);

  const malformedNumber = normalizeNullProfileEmail(validProfile({ securityScore: "0" }));
  assert.equal(isUsableProfile(malformedNumber), false);

  const malformedEmail = validProfile({ email: 42 });
  assert.equal(normalizeNullProfileEmail(malformedEmail), malformedEmail);
  assert.equal(isUsableProfile(malformedEmail), false);

  const missingEmail = validProfile();
  delete missingEmail.email;
  assert.equal(normalizeNullProfileEmail(missingEmail), missingEmail);
  assert.equal(isUsableProfile(missingEmail), false);

  const missingIdentity = validProfile();
  delete missingIdentity.id;
  assert.equal(isUsableProfile(normalizeNullProfileEmail(missingIdentity)), false);
});