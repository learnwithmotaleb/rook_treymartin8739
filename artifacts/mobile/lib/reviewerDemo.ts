/**
 * In-memory adapter for the server-authorized reviewer preview.
 *
 * No reviewer fixture or action state is persisted on device. A session is
 * tied to the authenticated Clerk user key and is discarded synchronously on
 * logout, account change, or API-token reset.
 */

export interface ReviewerDemoAccount {
  id: string;
  platform: string;
  username: string;
  displayName: string | null;
  followers: number;
  verified: false;
  needsReconnect: boolean;
  photosIndexed: number;
  captionsIndexed: number;
  reelsIndexed: number;
  lastSynced: string | null;
  connectionType: "demo";
  isSample: true;
  [key: string]: unknown;
}

export interface ReviewerDemoMediaItem {
  id: string;
  type: "image" | "video" | "carousel";
  url: string;
  thumbnailUrl: string;
  caption: string | null;
  postedAt: string | null;
  isSample?: true;
}

export interface ReviewerDemoMedia {
  items: ReviewerDemoMediaItem[];
  hasAccess: boolean;
  reason?: string;
  isSample: true;
}

export interface ReviewerDemoThreat {
  id: string;
  isSample: true;
  scanJobId: string | null;
  type: string;
  severity: "high" | "medium" | "low";
  platform: string | null;
  title: string;
  description: string;
  details: string;
  aiExplanation: string;
  threatScore: number;
  suspiciousUsername: string | null;
  matchedMediaCount: number;
  evidenceCount?: number;
  evidence: Array<Record<string, unknown>>;
  scoreBreakdown: Record<string, number>;
  detectedSignals: string[];
  resolved: boolean;
  resolvedAt: string | null;
  resolveAction: string | null;
  createdAt: string;
  [key: string]: unknown;
}

export interface ReviewerDemoInfo {
  version: 1;
  mode: "reviewer_demo";
  isSample: true;
  actions: "local_preview_only";
  notice: string;
  accounts: ReviewerDemoAccount[];
  mediaByAccount: Record<string, ReviewerDemoMedia>;
  threats: ReviewerDemoThreat[];
  profileSummary: {
    securityScore: number;
    scoreTrend: number;
    monitored: number;
    lastScan: string;
    totalPhotosIndexed: number;
    totalCaptionsIndexed: number;
    reelsIndexed: number;
    fingerprintUpdated: string;
    isSample: true;
  };
  identityBadge: Record<string, unknown> & { isSample: true };
  consent: {
    hasConsent: boolean;
    consentedAt: string | null;
    consentVersion: string | null;
    isSample: true;
  };
  quota: {
    canScan: boolean;
    scansUsed: number;
    scansAllowed: number;
    tier: string;
    imagesPerScan?: number;
    upgradeTo?: string;
    message: string | null;
    resetsAt?: string | null;
    isSample: true;
  };
  latestScan?: Record<string, unknown> | null;
  scanHistory?: Array<Record<string, unknown>>;
  capabilities: Array<{ route: string; feature: string }>;
}

export interface ReviewerDemoScanJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  currentStep: string | null;
  threatsFound: number;
  startedAt: string | null;
  completedAt: string | null;
  isSample: true;
}

export type ReviewerDemoAuthorizationStatus = "pending" | "demo" | "live" | "unavailable";
export interface ReviewerDemoAuthorizationState {
  accountKey: string | null;
  status: ReviewerDemoAuthorizationStatus;
  revision: number;
}
export type ReviewerDemoAuthorizationDecision =
  | { status: "demo"; info: ReviewerDemoInfo }
  | { status: "live" }
  | { status: "unavailable" };

type Listener = (info: ReviewerDemoInfo | null) => void;
type AuthorizationListener = (state: ReviewerDemoAuthorizationState) => void;
type Loader = () => Promise<unknown>;

let infoLoader: Loader = async () => null;
let authorizationState: ReviewerDemoAuthorizationState = {
  accountKey: null,
  status: "pending",
  revision: 0,
};
let currentSession: {
  accountKey: string;
  info: ReviewerDemoInfo;
  profilePatch: Record<string, unknown>;
  scanStartedAt: number | null;
  scanId: string | null;
  scanCount: number;
  accountCount: number;
  onboardingAnswers: Record<string, unknown>;
} | null = null;
const listeners = new Set<Listener>();
const authorizationListeners = new Set<AuthorizationListener>();

/** Login/logout generation guard for async account-scoped continuations. */
export class AccountSessionGuard {
  private generation = 0;
  private accountKey: string | null = null;

  begin(accountKey: string | null): number {
    this.generation += 1;
    this.accountKey = accountKey;
    return this.generation;
  }

  invalidate(): number {
    return this.begin(null);
  }

  isCurrent(generation: number, accountKey: string | null): boolean {
    return this.generation === generation && this.accountKey === accountKey;
  }
}

export function getReviewerDemoAuthorizationState(): ReviewerDemoAuthorizationState {
  return { ...authorizationState };
}

export function invalidateReviewerAuthorizationForOwnerChange(
  currentOwnerId: string | null,
  nextOwnerId: string | null,
): boolean {
  if (currentOwnerId === nextOwnerId) return false;
  const scope = getReviewerDemoAuthorizationState();
  resetReviewerDemoSession();
  setReviewerDemoAuthorizationStatus(scope.accountKey, "pending");
  return true;
}

export function subscribeReviewerDemoAuthorization(
  listener: AuthorizationListener,
): () => void {
  authorizationListeners.add(listener);
  return () => authorizationListeners.delete(listener);
}

function notifyAuthorizationState(): void {
  const snapshot = getReviewerDemoAuthorizationState();
  for (const listener of authorizationListeners) listener(snapshot);
}

export function setReviewerDemoAuthorizationStatus(
  accountKey: string | null,
  status: ReviewerDemoAuthorizationStatus,
): boolean {
  if (authorizationState.accountKey !== accountKey) return false;
  if (authorizationState.status !== status) {
    authorizationState = { ...authorizationState, status, revision: authorizationState.revision + 1 };
    notifyAuthorizationState();
  }
  return true;
}

export function beginReviewerDemoAuthorization(accountKey: string | null): void {
  const shouldDiscardPreviousAccountSession =
    currentSession !== null && currentSession.accountKey !== accountKey;
  authorizationState = {
    accountKey,
    status: accountKey ? "pending" : "unavailable",
    revision: authorizationState.revision + 1,
  };
  notifyAuthorizationState();
  if (shouldDiscardPreviousAccountSession) resetReviewerDemoSession();
}

export function isReviewerDemoAuthorizationRevisionCurrent(revision: number): boolean {
  return authorizationState.revision === revision;
}

export function classifyReviewerDemoAuthorizationResult(result:
  | { kind: "payload"; payload: unknown }
  | { kind: "http"; statusCode: number; errorCode: string | null }
  | { kind: "network" }
): ReviewerDemoAuthorizationDecision {
  if (
    result.kind === "http" &&
    result.statusCode === 404 &&
    result.errorCode === "reviewer_demo_not_authorized"
  ) return { status: "live" };
  if (result.kind !== "payload") return { status: "unavailable" };
  const info = parseReviewerDemoInfo(result.payload);
  return info ? { status: "demo", info } : { status: "unavailable" };
}

const bootstrapReadPaths = new Set([
  "/me",
  "/reviewer/demo",
  "/billing/subscription",
  "/me/photo-consent",
  "/oauth/redirect-uris",
]);
const actualLegalWriteMethods = new Map<string, Set<string>>([
  ["/me/terms", new Set(["POST"])],
  ["/me/age-confirm", new Set(["POST"])],
  ["/me/photo-consent", new Set(["POST", "DELETE"])],
]);

/** Central fail-closed API policy for requests made before/inside preview. */
export function isReviewerDemoNetworkRequestAllowed(
  status: ReviewerDemoAuthorizationStatus,
  path: string,
  method = "GET",
): boolean {
  const normalizedMethod = method.toUpperCase();
  const pathname = path.split("?", 1)[0] ?? path;
  if (pathname === "/auth/app-review-ticket" && normalizedMethod === "POST") return true;
  if (pathname === "/billing/revenuecat-sync" && normalizedMethod === "POST") return true;
  if (actualLegalWriteMethods.get(pathname)?.has(normalizedMethod)) return true;
  if (normalizedMethod === "GET" && bootstrapReadPaths.has(pathname)) {
    return pathname !== "/reviewer/demo" || status === "pending" || status === "unavailable";
  }
  if (normalizedMethod === "GET" && pathname.startsWith("/config/")) return true;
  return status === "live";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pickFields<T>(
  source: Record<string, unknown>,
  fields: readonly string[],
): T {
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (Object.hasOwn(source, field)) picked[field] = source[field];
  }
  return picked as unknown as T;
}

const ACCOUNT_FIELDS = [
  "id", "platform", "username", "displayName", "followers", "verified",
  "needsReconnect", "photosIndexed", "captionsIndexed", "reelsIndexed",
  "lastSynced", "connectionType", "isSample",
] as const;
const MEDIA_FIELDS = ["hasAccess", "reason", "isSample"] as const;
const MEDIA_ITEM_FIELDS = [
  "id", "type", "url", "thumbnailUrl", "caption", "postedAt", "isSample",
] as const;
const PROFILE_SUMMARY_FIELDS = [
  "securityScore", "scoreTrend", "monitored", "lastScan", "totalPhotosIndexed",
  "totalCaptionsIndexed", "reelsIndexed", "fingerprintUpdated", "isSample",
] as const;
const IDENTITY_BADGE_FIELDS = [
  "confidenceTier", "overallConfidence", "verifiedPlatformCount",
  "verifiedPlatforms", "badge", "isSample", "anchorHashCount",
] as const;
const CONSENT_FIELDS = [
  "hasConsent", "consentedAt", "consentVersion", "isSample",
] as const;
const QUOTA_FIELDS = [
  "canScan", "scansUsed", "scansAllowed", "tier", "imagesPerScan",
  "upgradeTo", "message", "resetsAt", "isSample",
] as const;
const SCAN_FIELDS = [
  "id", "status", "progress", "currentStep", "threatsFound", "startedAt",
  "completedAt", "isSample",
] as const;
const THREAT_FIELDS = [
  "id", "scanJobId", "type", "severity", "platform", "title", "description",
  "details", "aiExplanation", "threatScore", "suspiciousUsername",
  "matchedMediaCount", "evidenceCount", "scoreBreakdown", "detectedSignals",
  "resolved", "resolveAction", "resolvedAt", "isSample", "createdAt",
  "profileUrl", "accountMeta", "confirmedVictims", "crossUserEscalation",
  "postDatingDays", "isLocked",
] as const;
const EVIDENCE_FIELDS = [
  "id", "type", "similarity", "label", "yourCaption", "stolenCaption",
  "yourPhotoUrl", "stolenPhotoUrl",
] as const;
const SCORE_BREAKDOWN_FIELDS = [
  "mediaSimilarity", "contentReuse", "profileSimilarity", "bioSimilarity",
  "usernameSimilarity", "behavioral",
] as const;
const ACCOUNT_META_FIELDS = [
  "followers", "following", "totalPosts", "accountAgeDays", "engagementRate",
] as const;

function isValidScan(value: unknown): value is Record<string, unknown> {
  return isRecord(value) &&
    typeof value.id === "string" &&
    value.id.startsWith("review-demo-scan-") &&
    ["queued", "running", "completed", "failed"].includes(String(value.status)) &&
    isNonNegativeInteger(value.progress) &&
    (value.currentStep === null || typeof value.currentStep === "string") &&
    isNonNegativeInteger(value.threatsFound) &&
    isNullableString(value.startedAt) &&
    isNullableString(value.completedAt) &&
    value.isSample === true;
}

/** Validate the authorization marker and every fixture boundary before activation. */
export function parseReviewerDemoInfo(payload: unknown): ReviewerDemoInfo | null {
  if (!isRecord(payload)) return null;
  if (
    payload.version !== 1 ||
    payload.mode !== "reviewer_demo" ||
    payload.isSample !== true ||
    payload.actions !== "local_preview_only" ||
    typeof payload.notice !== "string" ||
    !Array.isArray(payload.accounts) ||
    !Array.isArray(payload.threats) ||
    !isRecord(payload.mediaByAccount) ||
    !isRecord(payload.profileSummary) ||
    payload.profileSummary.isSample !== true ||
    !isRecord(payload.identityBadge) ||
    payload.identityBadge.isSample !== true ||
    !isRecord(payload.consent) ||
    payload.consent.isSample !== true ||
    !isRecord(payload.quota) ||
    payload.quota.isSample !== true ||
    !Array.isArray(payload.capabilities)
  ) {
    return null;
  }

  const accounts = payload.accounts as Array<Record<string, unknown>>;
  const supportedPlatforms = new Set(["instagram", "facebook", "x"]);
  const accountIds = new Set<string>();
  const accountPlatforms = new Set<string>();
  if (accounts.length !== supportedPlatforms.size || !accounts.every((account) => {
    if (!isRecord(account)) return false;
    if (
      typeof account.id !== "string" ||
      !account.id.startsWith("review-demo-account-") ||
      accountIds.has(account.id) ||
      typeof account.platform !== "string" ||
      !supportedPlatforms.has(account.platform) ||
      accountPlatforms.has(account.platform) ||
      typeof account.username !== "string" ||
      !(account.displayName === null || typeof account.displayName === "string") ||
      !isNonNegativeInteger(account.followers) ||
      account.isSample !== true ||
      account.verified !== false ||
      account.connectionType !== "demo" ||
      typeof account.needsReconnect !== "boolean" ||
      !(account.lastSynced === null || typeof account.lastSynced === "string") ||
      (account.profileUrl !== undefined && account.profileUrl !== null) ||
      !isNonNegativeInteger(account.photosIndexed) ||
      !isNonNegativeInteger(account.captionsIndexed) ||
      !isNonNegativeInteger(account.reelsIndexed)
    ) return false;
    accountIds.add(account.id);
    accountPlatforms.add(account.platform);
    return true;
  })) return null;

  const threats = payload.threats;
  if (!threats.every((threat) => {
    if (!isRecord(threat)) return false;
    const validEvidence = Array.isArray(threat.evidence) && threat.evidence.every((evidence) =>
      isRecord(evidence) &&
      typeof evidence.id === "string" &&
      ["profile_photo", "post_photo", "reel_thumbnail", "caption"].includes(String(evidence.type)) &&
      isFiniteNumber(evidence.similarity) &&
      typeof evidence.label === "string" &&
      (evidence.yourCaption === undefined || typeof evidence.yourCaption === "string") &&
      (evidence.stolenCaption === undefined || typeof evidence.stolenCaption === "string") &&
      (evidence.yourPhotoUrl === undefined || typeof evidence.yourPhotoUrl === "string") &&
      (evidence.stolenPhotoUrl === undefined || typeof evidence.stolenPhotoUrl === "string")
    );
    const sourceScoreBreakdown = threat.scoreBreakdown;
    const scoreBreakdown = isRecord(sourceScoreBreakdown) &&
      SCORE_BREAKDOWN_FIELDS.every((field) => isFiniteNumber(sourceScoreBreakdown[field]));
    const accountMeta = threat.accountMeta === undefined ||
      threat.accountMeta === null ||
      (isRecord(threat.accountMeta) &&
        Object.entries(threat.accountMeta).every(([key, value]) =>
          !ACCOUNT_META_FIELDS.includes(key as typeof ACCOUNT_META_FIELDS[number]) ||
          isFiniteNumber(value)
        ) &&
        isFiniteNumber(threat.accountMeta.followers));
    return (
      typeof threat.id === "string" &&
      threat.id.startsWith("review-demo-threat-") &&
      threat.isSample === true &&
      (threat.scanJobId === null || typeof threat.scanJobId === "string") &&
      typeof threat.type === "string" &&
      ["high", "medium", "low"].includes(String(threat.severity)) &&
      isNullableString(threat.platform) &&
      typeof threat.title === "string" &&
      typeof threat.description === "string" &&
      typeof threat.details === "string" &&
      typeof threat.aiExplanation === "string" &&
      isFiniteNumber(threat.threatScore) &&
      isNullableString(threat.suspiciousUsername) &&
      (threat.profileUrl === undefined || threat.profileUrl === null) &&
      isNonNegativeInteger(threat.matchedMediaCount) &&
      (threat.evidenceCount === undefined || isNonNegativeInteger(threat.evidenceCount)) &&
      validEvidence &&
      scoreBreakdown &&
      Array.isArray(threat.detectedSignals) &&
      threat.detectedSignals.every((signal) => typeof signal === "string") &&
      typeof threat.resolved === "boolean" &&
      isNullableString(threat.resolveAction) &&
      isNullableString(threat.resolvedAt) &&
      typeof threat.createdAt === "string" &&
      accountMeta &&
      (threat.confirmedVictims === undefined ||
        threat.confirmedVictims === null ||
        isNonNegativeInteger(threat.confirmedVictims)) &&
      (threat.crossUserEscalation === undefined ||
        typeof threat.crossUserEscalation === "boolean") &&
      (threat.postDatingDays === undefined ||
        threat.postDatingDays === null ||
        isFiniteNumber(threat.postDatingDays)) &&
      (threat.isLocked === undefined || typeof threat.isLocked === "boolean")
    );
  })) return null;

  const mediaByAccount = payload.mediaByAccount;
  const mediaAccountIds = Object.keys(mediaByAccount);
  if (
    mediaAccountIds.length !== accountIds.size ||
    mediaAccountIds.some((id) => !accountIds.has(id))
  ) return null;

  for (const account of accounts) {
    const media = mediaByAccount[account.id as string];
    if (
      !isRecord(media) ||
      media.isSample !== true ||
      typeof media.hasAccess !== "boolean" ||
      (media.reason !== undefined && typeof media.reason !== "string") ||
      !Array.isArray(media.items)
    ) return null;
    if (!media.items.every((item) =>
      isRecord(item) &&
      typeof item.id === "string" &&
      item.id.startsWith("review-demo-") &&
      typeof item.url === "string" &&
      typeof item.thumbnailUrl === "string" &&
      ["image", "video", "carousel"].includes(String(item.type)) &&
      (item.caption === null || typeof item.caption === "string") &&
      (item.postedAt === null || typeof item.postedAt === "string") &&
      (item.isSample === undefined || item.isSample === true)
    )) return null;
  }

  const profileSummary = payload.profileSummary;
  const totalPhotosIndexed = accounts.reduce(
    (sum, account) => sum + (account.photosIndexed as number),
    0,
  );
  const totalCaptionsIndexed = accounts.reduce(
    (sum, account) => sum + (account.captionsIndexed as number),
    0,
  );
  const reelsIndexed = accounts.reduce(
    (sum, account) => sum + (account.reelsIndexed as number),
    0,
  );
  if (
    profileSummary.monitored !== accounts.length ||
    profileSummary.totalPhotosIndexed !== totalPhotosIndexed ||
    profileSummary.totalCaptionsIndexed !== totalCaptionsIndexed ||
    profileSummary.reelsIndexed !== reelsIndexed ||
    !isNonNegativeInteger(profileSummary.securityScore) ||
    !isNonNegativeInteger(profileSummary.monitored) ||
    !isNonNegativeInteger(profileSummary.totalPhotosIndexed) ||
    !isNonNegativeInteger(profileSummary.totalCaptionsIndexed) ||
    !isNonNegativeInteger(profileSummary.reelsIndexed) ||
    typeof profileSummary.scoreTrend !== "number" ||
    !Number.isFinite(profileSummary.scoreTrend) ||
    typeof profileSummary.lastScan !== "string" ||
    typeof profileSummary.fingerprintUpdated !== "string"
  ) return null;

  const identityBadge = payload.identityBadge;
  if (
    typeof identityBadge.confidenceTier !== "string" ||
    !isFiniteNumber(identityBadge.overallConfidence) ||
    !isNonNegativeInteger(identityBadge.verifiedPlatformCount) ||
    !Array.isArray(identityBadge.verifiedPlatforms) ||
    !identityBadge.verifiedPlatforms.every((platform) => typeof platform === "string") ||
    !isRecord(identityBadge.badge) ||
    typeof identityBadge.badge.tier !== "string" ||
    typeof identityBadge.badge.label !== "string" ||
    typeof identityBadge.badge.description !== "string" ||
    typeof identityBadge.badge.color !== "string" ||
    (identityBadge.anchorHashCount !== undefined &&
      !isNonNegativeInteger(identityBadge.anchorHashCount))
  ) return null;

  const consent = payload.consent;
  if (
    typeof consent.hasConsent !== "boolean" ||
    !isNullableString(consent.consentedAt) ||
    !isNullableString(consent.consentVersion)
  ) return null;

  const quota = payload.quota;
  if (
    typeof quota.canScan !== "boolean" ||
    !isNonNegativeInteger(quota.scansUsed) ||
    !isNonNegativeInteger(quota.scansAllowed) ||
    typeof quota.tier !== "string" ||
    (quota.imagesPerScan !== undefined &&
      quota.imagesPerScan !== -1 &&
      !isNonNegativeInteger(quota.imagesPerScan)) ||
    (quota.upgradeTo !== undefined && typeof quota.upgradeTo !== "string") ||
    !isNullableString(quota.message) ||
    (quota.resetsAt !== undefined && !isNullableString(quota.resetsAt))
  ) return null;

  const capabilities = payload.capabilities;
  if (!capabilities.every((capability) =>
    isRecord(capability) &&
    typeof capability.route === "string" &&
    typeof capability.feature === "string"
  )) return null;

  if (
    (payload.latestScan !== undefined &&
      payload.latestScan !== null &&
      !isValidScan(payload.latestScan)) ||
    (payload.scanHistory !== undefined &&
      (!Array.isArray(payload.scanHistory) || !payload.scanHistory.every(isValidScan)))
  ) return null;

  const sanitizedAccounts = accounts.map((account) =>
    pickFields<ReviewerDemoAccount>(account, ACCOUNT_FIELDS)
  );
  const sanitizedMediaByAccount: Record<string, ReviewerDemoMedia> = {};
  for (const account of accounts) {
    const sourceMedia = mediaByAccount[account.id as string] as Record<string, unknown>;
    sanitizedMediaByAccount[account.id as string] = {
      ...pickFields<ReviewerDemoMedia>(sourceMedia, MEDIA_FIELDS),
      items: (sourceMedia.items as Array<Record<string, unknown>>).map((item) =>
        pickFields<ReviewerDemoMediaItem>(item, MEDIA_ITEM_FIELDS)
      ),
    };
  }
  const sanitizedThreats = threats.map((threat) => {
    const sourceThreat = threat as Record<string, unknown>;
    const accountMeta = sourceThreat.accountMeta;
    return {
      ...pickFields<ReviewerDemoThreat>(sourceThreat, THREAT_FIELDS),
      evidence: (sourceThreat.evidence as Array<Record<string, unknown>>).map((evidence) =>
        pickFields(evidence, EVIDENCE_FIELDS)
      ),
      scoreBreakdown: pickFields(
        sourceThreat.scoreBreakdown as Record<string, unknown>,
        SCORE_BREAKDOWN_FIELDS,
      ) as Record<string, number>,
      ...(isRecord(accountMeta)
        ? { accountMeta: pickFields(accountMeta, ACCOUNT_META_FIELDS) }
        : {}),
    } as ReviewerDemoThreat;
  });
  const sanitized: ReviewerDemoInfo = {
    version: 1,
    mode: "reviewer_demo",
    isSample: true,
    actions: "local_preview_only",
    notice: payload.notice,
    accounts: sanitizedAccounts,
    mediaByAccount: sanitizedMediaByAccount,
    threats: sanitizedThreats,
    profileSummary: pickFields<ReviewerDemoInfo["profileSummary"]>(
      profileSummary,
      PROFILE_SUMMARY_FIELDS,
    ),
    identityBadge: {
      ...pickFields(identityBadge, IDENTITY_BADGE_FIELDS),
      badge: pickFields(identityBadge.badge, ["tier", "label", "description", "color"]),
      isSample: true,
    },
    consent: pickFields<ReviewerDemoInfo["consent"]>(consent, CONSENT_FIELDS),
    quota: pickFields<ReviewerDemoInfo["quota"]>(quota, QUOTA_FIELDS),
    capabilities: capabilities.map((capability) => pickFields(capability, ["route", "feature"])),
  };
  if (payload.latestScan !== undefined) {
    sanitized.latestScan = payload.latestScan === null
      ? null
      : pickFields(payload.latestScan as Record<string, unknown>, SCAN_FIELDS);
  }
  if (payload.scanHistory !== undefined) {
    sanitized.scanHistory = (payload.scanHistory as Array<Record<string, unknown>>).map((scan) =>
      pickFields(scan, SCAN_FIELDS)
    );
  }
  return sanitized;
}

export function setReviewerDemoInfoLoader(loader: Loader): void {
  infoLoader = loader;
}

/** Fetches, but does not activate, the server-authorized demo payload. */
export async function getReviewerDemoInfo(): Promise<ReviewerDemoInfo | null> {
  try {
    return parseReviewerDemoInfo(await infoLoader());
  } catch {
    // Missing authorization, 404, and network errors all preserve live mode.
    return null;
  }
}

export function isReviewerDemoActive(): boolean {
  return currentSession !== null;
}

export function mapThreatSummaryHighConfidence(
  isSample: boolean,
  serverHighConfidence: boolean | undefined,
  detectedSignals: unknown,
): boolean {
  if (!isSample) return serverHighConfidence ?? false;
  return Boolean(
    currentSession &&
    Array.isArray(detectedSignals) &&
    detectedSignals.includes("firstScanHighConfidence")
  );
}

export function subscribeReviewerDemo(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  const snapshot = getReviewerDemoSnapshot();
  for (const listener of listeners) listener(snapshot);
}

export function getReviewerDemoSnapshot(): ReviewerDemoInfo | null {
  return currentSession ? clone(currentSession.info) : null;
}

export function activateReviewerDemo(info: ReviewerDemoInfo, accountKey: string, bundledPhotoUri?: string): void {
  if (!accountKey) return;
  if (authorizationState.accountKey === null) {
    beginReviewerDemoAuthorization(accountKey);
  }
  if (authorizationState.accountKey !== accountKey) return;
  setReviewerDemoAuthorizationStatus(accountKey, "demo");
  if (currentSession?.accountKey === accountKey) return;
  const sampleInfo = clone(info);
  // Only the authorized sample session uses this embedded image. Live photo
  // stores, server fixtures and actual findings remain untouched.
  if (bundledPhotoUri) {
    for (const media of Object.values(sampleInfo.mediaByAccount)) {
      for (const item of media.items) {
        item.url = bundledPhotoUri;
        item.thumbnailUrl = bundledPhotoUri;
      }
    }
    for (const threat of sampleInfo.threats) {
      for (const evidence of threat.evidence) {
        if (["profile_photo", "post_photo", "reel_thumbnail"].includes(String(evidence.type))) {
          evidence.yourPhotoUrl = bundledPhotoUri;
          evidence.stolenPhotoUrl = bundledPhotoUri;
        }
      }
    }
  }
  currentSession = {
    accountKey,
    info: sampleInfo,
    profilePatch: {},
    scanStartedAt: null,
    scanId: null,
    scanCount: 0,
    accountCount: 0,
    onboardingAnswers: {},
  };
  notify();
}

/** Synchronously discards every reviewer-only value and local preview action. */
export function resetReviewerDemoSession(): void {
  if (!currentSession) return;
  currentSession = null;
  notify();
}

export function getReviewerDemoProfilePatch(): Record<string, unknown> {
  return currentSession ? { ...currentSession.profilePatch } : {};
}

export function updateReviewerDemoProfile(patch: Record<string, unknown>): void {
  if (!currentSession) return;
  currentSession.profilePatch = { ...currentSession.profilePatch, ...patch };
  notify();
}

export function saveReviewerDemoOnboardingAnswers(answers: Record<string, unknown>): void {
  if (!currentSession) throw new Error("Reviewer preview is not active.");
  currentSession.onboardingAnswers = clone(answers);
}

export function updateReviewerDemoConsent(hasConsent: boolean): void {
  if (!currentSession) return;
  currentSession.info.consent = {
    ...currentSession.info.consent,
    hasConsent,
    consentedAt: hasConsent ? new Date().toISOString() : null,
  };
  if (!hasConsent) {
    currentSession.info.mediaByAccount = Object.fromEntries(
      Object.entries(currentSession.info.mediaByAccount).map(([id, media]) => [
        id,
        { ...media, items: [], hasAccess: false, reason: "Sample media is hidden while preview consent is off." },
      ]),
    );
    currentSession.info.accounts = currentSession.info.accounts.map((account) => ({
      ...account,
      photosIndexed: 0,
      captionsIndexed: 0,
      reelsIndexed: 0,
    }));
    syncReviewerDemoProfileCounts();
  }
  notify();
}

function syncReviewerDemoProfileCounts(): void {
  if (!currentSession) return;
  const accounts = currentSession.info.accounts;
  currentSession.info.profileSummary = {
    ...currentSession.info.profileSummary,
    monitored: accounts.length,
    totalPhotosIndexed: accounts.reduce((sum, account) => sum + account.photosIndexed, 0),
    totalCaptionsIndexed: accounts.reduce((sum, account) => sum + account.captionsIndexed, 0),
    reelsIndexed: accounts.reduce((sum, account) => sum + account.reelsIndexed, 0),
  };
}

export function clearReviewerDemoMedia(): void {
  if (!currentSession) return;
  currentSession.info.mediaByAccount = Object.fromEntries(
    Object.entries(currentSession.info.mediaByAccount).map(([id, media]) => [
      id,
      { ...media, items: [], hasAccess: false, reason: "Sample media was cleared in this preview." },
    ]),
  );
  currentSession.info.accounts = currentSession.info.accounts.map((account) => ({
    ...account,
    photosIndexed: 0,
    captionsIndexed: 0,
    reelsIndexed: 0,
  }));
  syncReviewerDemoProfileCounts();
  notify();
}

export function addReviewerDemoAccount(
  platform: string,
  username: string,
  displayName?: string,
): ReviewerDemoAccount {
  if (!currentSession) throw new Error("Reviewer preview is not active.");
  if (!["instagram", "facebook", "x"].includes(platform)) {
    throw new Error("Only Instagram, Facebook, and X are available in reviewer preview.");
  }
  const sequence = ++currentSession.accountCount;
  const account: ReviewerDemoAccount = {
    id: `review-demo-account-local-${sequence}`,
    platform,
    username,
    displayName: displayName ?? null,
    followers: 0,
    verified: false,
    needsReconnect: false,
    photosIndexed: 0,
    captionsIndexed: 0,
    reelsIndexed: 0,
    lastSynced: null,
    connectionType: "demo",
    isSample: true,
  };
  currentSession.info.accounts = [...currentSession.info.accounts, account];
  currentSession.info.mediaByAccount[account.id] = {
    items: [],
    hasAccess: false,
    reason: "No provider is connected in this local preview.",
    isSample: true,
  };
  syncReviewerDemoProfileCounts();
  notify();
  return { ...account };
}

export function removeReviewerDemoAccount(id: string): void {
  if (!currentSession || !id.startsWith("review-demo-")) return;
  currentSession.info.accounts = currentSession.info.accounts.filter((account) => account.id !== id);
  delete currentSession.info.mediaByAccount[id];
  syncReviewerDemoProfileCounts();
  notify();
}

export function updateReviewerDemoAccount(
  id: string,
  updates: Record<string, unknown>,
): ReviewerDemoAccount {
  const account = currentSession?.info.accounts.find((item) => item.id === id);
  if (!currentSession || !account) throw new Error("Sample account is no longer available.");
  const safeUpdates: Partial<ReviewerDemoAccount> = {};
  if (typeof updates.displayName === "string") safeUpdates.displayName = updates.displayName;
  if (isNonNegativeInteger(updates.followers)) safeUpdates.followers = updates.followers;
  currentSession.info.accounts = currentSession.info.accounts.map((item) =>
    item.id === id
      ? { ...item, ...safeUpdates, id: item.id, isSample: true, verified: false, connectionType: "demo" }
      : item,
  );
  notify();
  return { ...currentSession.info.accounts.find((item) => item.id === id)! };
}

export function resolveReviewerDemoThreat(id: string, action?: string): void {
  if (!currentSession || !id.startsWith("review-demo-threat-")) return;
  const now = new Date().toISOString();
  currentSession.info.threats = currentSession.info.threats.map((threat) =>
    threat.id === id
      ? { ...threat, resolved: true, resolveAction: action ?? "resolved_manually", resolvedAt: now }
      : threat,
  );
  notify();
}

export function bulkResolveReviewerDemoThreats(ids: string[]): void {
  ids.forEach((id) => resolveReviewerDemoThreat(id));
}

export function getReviewerDemoThreat(id: string): ReviewerDemoThreat | null {
  const threat = currentSession?.info.threats.find((item) => item.id === id);
  return threat ? clone(threat) : null;
}

export function getReviewerDemoMedia(accountId: string): ReviewerDemoMedia | null {
  const media = currentSession?.info.mediaByAccount[accountId];
  return media ? clone(media) : null;
}

export function getReviewerDemoQuota(): ReviewerDemoInfo["quota"] | null {
  return currentSession ? { ...currentSession.info.quota } : null;
}

export function startReviewerDemoScan(): ReviewerDemoScanJob {
  if (!currentSession) throw new Error("Reviewer preview is not active.");
  currentSession.scanCount += 1;
  currentSession.scanStartedAt = Date.now();
  currentSession.scanId = `review-demo-scan-local-${currentSession.scanCount}`;
  currentSession.info.latestScan = {
    id: currentSession.scanId,
    status: "running",
    progress: 0,
    currentStep: "Preparing sample scan",
    threatsFound: 0,
    startedAt: new Date(currentSession.scanStartedAt).toISOString(),
    completedAt: null,
    isSample: true,
  };
  currentSession.info.quota = {
    ...currentSession.info.quota,
    canScan: true,
    scansUsed: currentSession.info.quota.scansUsed + 1,
    message: "Sample scan completed locally. No account or photo data was sent.",
    isSample: true,
  };
  notify();
  return getReviewerDemoScanStatus(currentSession.scanId)!;
}

export function getReviewerDemoScanStatus(id: string): ReviewerDemoScanJob | null {
  if (!currentSession || !currentSession.scanStartedAt || currentSession.scanId !== id) return null;
  const elapsed = Date.now() - currentSession.scanStartedAt;
  const progress = Math.min(100, Math.floor((elapsed / 3_000) * 100));
  const steps = [
    "Preparing sample scan",
    "Reviewing sample accounts",
    "Comparing sample media",
    "Preparing sample results",
  ];
  const isComplete = progress >= 100;
  const stepIndex = Math.min(steps.length - 1, Math.floor(progress / 25));
  const job: ReviewerDemoScanJob = {
    id,
    status: isComplete ? "completed" : "running",
    progress,
    currentStep: isComplete ? null : steps[stepIndex]!,
    threatsFound: isComplete ? currentSession.info.threats.length : 0,
    startedAt: new Date(currentSession.scanStartedAt).toISOString(),
    completedAt: isComplete ? new Date(currentSession.scanStartedAt + 3_000).toISOString() : null,
    isSample: true,
  };
  if (isComplete && currentSession.info.latestScan) {
    currentSession.info.latestScan = { ...job };
  }
  return job;
}

export function getReviewerDemoScanResults(): ReviewerDemoThreat[] {
  return currentSession ? clone(currentSession.info.threats) : [];
}
