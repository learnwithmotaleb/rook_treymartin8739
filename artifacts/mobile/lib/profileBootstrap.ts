import type { UserProfile } from "./api";

/** Legacy database rows may have no email; keep that display field renderable. */
export function normalizeNullProfileEmail(profile: unknown): unknown {
  if (
    !profile ||
    typeof profile !== "object" ||
    Array.isArray(profile) ||
    (profile as Record<string, unknown>).email !== null
  ) return profile;
  return { ...profile, email: "" };
}

export function isUsableProfile(profile: unknown): profile is UserProfile {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return false;
  const value = profile as Record<string, unknown>;
  const nullableString = (field: unknown) =>
    field === undefined || field === null || typeof field === "string";
  return (
    typeof value.id === "string" && value.id.length > 0 &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    typeof value.username === "string" &&
    typeof value.avatarInitials === "string" &&
    ["free", "pro", "premium"].includes(String(value.tier)) &&
    typeof value.securityScore === "number" && Number.isFinite(value.securityScore) &&
    typeof value.scoreTrend === "number" && Number.isFinite(value.scoreTrend) &&
    typeof value.monitored === "number" && Number.isFinite(value.monitored) &&
    typeof value.onboardingCompleted === "boolean" &&
    typeof value.lastScan === "string" &&
    typeof value.totalPhotosIndexed === "number" && Number.isFinite(value.totalPhotosIndexed) &&
    typeof value.totalCaptionsIndexed === "number" && Number.isFinite(value.totalCaptionsIndexed) &&
    typeof value.reelsIndexed === "number" && Number.isFinite(value.reelsIndexed) &&
    typeof value.fingerprintUpdated === "string" &&
    nullableString(value.termsVersion) &&
    nullableString(value.termsAcceptedAt) &&
    nullableString(value.ageConfirmedAt) &&
    nullableString(value.minimumAgeVersion) &&
    nullableString(value.avatarUrl)
  );
}