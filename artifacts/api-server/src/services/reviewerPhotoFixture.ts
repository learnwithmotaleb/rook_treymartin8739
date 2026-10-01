/**
 * Refresh only photo fields in explicitly marked review examples.
 * Never reconstruct history or reset resolution, scores, captions, or actions.
 */
const PHOTO_KEYS = new Set([
  "yourPhotoUrl",
  "stolenPhotoUrl",
  "suspiciousProfileImageUrl",
]);
const PHOTO_TYPES = new Set([
  "profile_photo",
  "post_photo",
  "reel_thumbnail",
  "profile_photo_match",
  "post_photo_theft",
]);

function replacePhotoUrls(value: unknown, photoUrl: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => replacePhotoUrls(item, photoUrl));
  }
  if (value === null || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  const updated: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    updated[key] = PHOTO_KEYS.has(key)
      ? photoUrl
      : replacePhotoUrls(item, photoUrl);
  }
  if (typeof record.type === "string" && PHOTO_TYPES.has(record.type)) {
    updated.yourPhotoUrl = photoUrl;
    updated.stolenPhotoUrl = photoUrl;
  }
  return updated;
}

export function refreshReviewerPhotoEvidence(
  evidenceJson: string | null,
  detectedSignalsJson: string | null,
  photoUrl: string,
): { evidenceJson: string; detectedSignalsJson: string } | null {
  // Malformed persisted JSON must fail explicitly, not silently overwrite data.
  const signals: unknown = JSON.parse(detectedSignalsJson ?? "{}");
  if (signals === null || typeof signals !== "object" || Array.isArray(signals)) {
    return null;
  }
  const marker = signals as Record<string, unknown>;
  if (marker.isReviewerSeed !== true && marker.isReviewerFixtureClone !== true) {
    return null;
  }
  const evidence: unknown = JSON.parse(evidenceJson ?? "[]");
  const updatedEvidence = JSON.stringify(replacePhotoUrls(evidence, photoUrl));
  const updatedSignals = JSON.stringify(replacePhotoUrls(signals, photoUrl));
  if (updatedEvidence === evidenceJson && updatedSignals === detectedSignalsJson) {
    return null;
  }
  return { evidenceJson: updatedEvidence, detectedSignalsJson: updatedSignals };
}