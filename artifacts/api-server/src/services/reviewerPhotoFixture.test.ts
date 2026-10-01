import assert from "node:assert/strict";
import { test } from "node:test";
import { refreshReviewerPhotoEvidence } from "./reviewerPhotoFixture";

const photo = "https://example.test/landing/review-photo.jpg?v=new";

test("updates both comparison sides only for marked review examples", () => {
  const evidence = [
    { id: "photo", type: "profile_photo", similarity: 61, yourPhotoUrl: "old", stolenPhotoUrl: "other" },
    { id: "caption", type: "caption", yourCaption: "Original", stolenCaption: "Example" },
  ];
  const signals = {
    isReviewerSeed: true,
    yourPhotoUrl: "old",
    suspiciousProfileImageUrl: "other",
    flags: ["firstScanHighConfidence"],
    evidence: [{ type: "profile_photo_match", yourPhotoUrl: "old", stolenPhotoUrl: "other" }],
  };
  const updated = refreshReviewerPhotoEvidence(JSON.stringify(evidence), JSON.stringify(signals), photo);
  assert.ok(updated);
  const parsed = JSON.parse(updated.evidenceJson);
  assert.equal(parsed[0].yourPhotoUrl, photo);
  assert.equal(parsed[0].stolenPhotoUrl, photo);
  assert.equal(parsed[0].similarity, 61);
  assert.deepEqual(parsed[1], evidence[1]);
  const nextSignals = JSON.parse(updated.detectedSignalsJson);
  assert.equal(nextSignals.isReviewerSeed, true);
  assert.deepEqual(nextSignals.flags, signals.flags);
  assert.equal(nextSignals.evidence[0].stolenPhotoUrl, photo);
});

test("never changes unmarked live findings", () => {
  assert.equal(refreshReviewerPhotoEvidence("[]", '{"yourPhotoUrl":"old"}', photo), null);
  assert.equal(refreshReviewerPhotoEvidence("[]", '{"isReviewerSeed":false}', photo), null);
});

test("is idempotent and also updates marked legacy examples", () => {
  const first = refreshReviewerPhotoEvidence(
    '[{"type":"post_photo","yourPhotoUrl":"old","stolenPhotoUrl":"old"}]',
    '{"isReviewerFixtureClone":true}',
    photo,
  );
  assert.ok(first);
  assert.equal(refreshReviewerPhotoEvidence(first.evidenceJson, first.detectedSignalsJson, photo), null);
});

test("does not introduce photo fields into non-photo login examples", () => {
  const updated = refreshReviewerPhotoEvidence(
    '[{"type":"caption","label":"Login anomaly"}]',
    '{"isReviewerSeed":true}',
    photo,
  );
  assert.equal(updated, null);
});