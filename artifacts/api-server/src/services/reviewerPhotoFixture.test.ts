import assert from "node:assert/strict";
import { test } from "node:test";
import {
  refreshReviewerPhotoEvidence,
  reviewerPhotoEvidenceForResponse,
  REVIEWER_PHOTO_URL,
} from "./reviewerPhotoFixture";

const photo = REVIEWER_PHOTO_URL;

test("detail response refreshes stale marked sample photo evidence on both sides", () => {
  const evidence = [
    {
      id: "photo",
      type: "profile_photo",
      similarity: 61,
      yourPhotoUrl: "https://tryrook.app/reviewer-sample-photo.jpg",
      stolenPhotoUrl: "https://tryrook.app/reviewer-sample-photo.jpg",
    },
    { id: "caption", type: "caption", yourCaption: "Original", stolenCaption: "Example" },
  ];
  const signals = {
    isReviewerSeed: true,
    yourPhotoUrl: "old",
    suspiciousProfileImageUrl: "other",
    flags: ["firstScanHighConfidence"],
    evidence: [{ type: "profile_photo_match", yourPhotoUrl: "old", stolenPhotoUrl: "other" }],
  };
  const updated = reviewerPhotoEvidenceForResponse(
    JSON.stringify(evidence),
    JSON.stringify(signals),
  );
  assert.ok(updated.evidenceJson);
  assert.ok(updated.detectedSignalsJson);
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
  const liveEvidence = '[{"type":"profile_photo","yourPhotoUrl":"live","stolenPhotoUrl":"live"}]';
  const liveSignals = '{"yourPhotoUrl":"live"}';
  assert.deepEqual(
    reviewerPhotoEvidenceForResponse(liveEvidence, liveSignals),
    { evidenceJson: liveEvidence, detectedSignalsJson: liveSignals },
  );
  assert.equal(refreshReviewerPhotoEvidence("[]", '{"isReviewerSeed":false}', photo), null);
});

test("malformed old sample JSON is left intact for safe detail serialization", () => {
  const malformedEvidence = "[";
  const signals = '{"isReviewerSeed":true}';
  assert.deepEqual(
    reviewerPhotoEvidenceForResponse(malformedEvidence, signals),
    { evidenceJson: malformedEvidence, detectedSignalsJson: signals },
  );
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