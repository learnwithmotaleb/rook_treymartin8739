import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  captureCurrentDevicePushToken,
  forgetCapturedDevicePushToken,
  scheduleScanCompleteNotification,
  scheduleThreatNotification,
} from "@/hooks/useNotifications";
import {
  getMe,
  getAccounts,
  listThreats,
  startScan as apiStartScan,
  getScanStatus,
  getScanResults,
  getLatestScan,
  getScanQuotaState,
  getSubscription,
  resolveThreat as apiResolveThreat,
  addAccount as apiAddAccount,
  removeAccount as apiRemoveAccount,
  updateAccount as apiUpdateAccount,
  getThreat,
  updateMe,
  reverseImageSearch,
  refreshAccountTokens,
  getPhotoConsent,
  type UserProfile,
  type AccountProfile,
  type ThreatSummary,
  type ScanQuotaState,
  ScanQuotaError,
  authorizeReviewerDemo,
  capturePinnedPushTokenCleanup,
  executePinnedPushTokenCleanup,
  getApiAuthTokenRevision,
  invalidateApiAuthToken,
} from "@/lib/api";
import {
  AccountSessionGuard,
  activateReviewerDemo,
  beginReviewerDemoAuthorization,
  getReviewerDemoAuthorizationState,
  getReviewerDemoSnapshot,
  isReviewerDemoActive,
  mapThreatSummaryHighConfidence,
  resetReviewerDemoSession,
  setReviewerDemoAuthorizationStatus,
  subscribeReviewerDemoAuthorization,
  subscribeReviewerDemo,
  type ReviewerDemoInfo,
} from "@/lib/reviewerDemo";
import {
  shouldCaptureLiveLogoutCleanup,
  type CapturedDevicePushToken,
  type PinnedPushTokenCleanup,
} from "@/lib/logoutCleanup";
import { isUsableProfile } from "@/lib/profileBootstrap";

export interface IndexedPhoto {
  id: string;
  localUri: string;
  base64?: string;
  addedAt: string;
  source: "camera_roll" | "account" | "review_example";
  accountId?: string;
  isSample?: boolean;
}

export type Severity = "high" | "medium" | "low";
export type ThreatType =
  | "impersonator"
  | "fake_account"
  | "leaked_password"
  | "suspicious_login"
  | "stolen_photo"
  | "scam"
;
export type Platform =
  | "instagram"
  | "x"
  | "tiktok"
  | "linkedin"
  | "youtube"
  | "facebook"
  | "snapchat"
  | null;

export interface ThreatScoreBreakdown {
  mediaSimilarity: number;
  contentReuse: number;
  profileSimilarity: number;
  bioSimilarity: number;
  usernameSimilarity: number;
  behavioral: number;
}

export interface MatchedEvidence {
  id: string;
  type: "profile_photo" | "post_photo" | "reel_thumbnail" | "caption";
  similarity: number;
  yourCaption?: string;
  stolenCaption?: string;
  yourPhotoUrl?: string;
  stolenPhotoUrl?: string;
  stolenPageUrl?: string;
  label: string;
  postContext?: "original_post" | "retweet" | "share" | "unknown";
  originalPoster?: string;
}

export interface Threat {
  id: string;
  isSample: boolean;
  scanJobId: string | null;
  type: ThreatType;
  severity: Severity;
  platform: Platform;
  title: string;
  description: string;
  details: string;
  time: string;
  resolved: boolean;
  resolveAction: string | null;
  resolvedAt: string | null;
  aiExplanation: string;
  threatScore: number;
  suspiciousUsername: string;
  matchedMediaCount: number;
  evidenceCount: number;
  evidence: MatchedEvidence[];
  scoreBreakdown: ThreatScoreBreakdown;
  detectedSignals: string[];
  highConfidence?: boolean;
}

export interface ConnectedAccount {
  id: string;
  platform: Platform;
  username: string;
  followers: number;
  verified: boolean;
  needsReconnect: boolean;
  photosIndexed: number;
  captionsIndexed: number;
  lastSynced: string | null;
}

export interface User {
  name: string;
  email: string;
  username: string;
  avatarInitials: string;
  avatarUrl: string | null;
  securityScore: number;
  scoreTrend: number;
  tier: "free" | "pro" | "premium";
  connectedAccounts: ConnectedAccount[];
  monitored: number;
  lastScan: string;
  nextScanDue: string | null;
  totalPhotosIndexed: number;
  totalCaptionsIndexed: number;
  reelsIndexed: number;
  fingerprintUpdated: string;
}

const DEFAULT_USER: User = {
  name: "",
  email: "",
  username: "",
  avatarInitials: "—",
  avatarUrl: null,
  securityScore: 0,
  scoreTrend: 0,
  tier: "free",
  connectedAccounts: [],
  monitored: 0,
  lastScan: "Never",
  nextScanDue: null,
  totalPhotosIndexed: 0,
  totalCaptionsIndexed: 0,
  reelsIndexed: 0,
  fingerprintUpdated: "Never",
};

interface AppContextType {
  user: User;
  threats: Threat[];
  indexedPhotos: IndexedPhoto[];
  reviewerSamplePhoto: IndexedPhoto | null;
  isLoggedIn: boolean;
  reviewerDemo: ReviewerDemoInfo | null;
  isReviewerDemo: boolean;
  hasSeenOnboarding: boolean;
  /** true while AsyncStorage is being read on first mount — gates all route redirects */
  isInitializing: boolean;
  /** true once the per-user hasSeenOnboarding flag has been loaded after login — gates the onboarding redirect specifically */
  isOnboardingReady: boolean;
  isScanning: boolean;
  scanProgress: number;
  scanCurrentStep: string | null;
  /** Number of potential threats created by the most recently completed scan. */
  lastScanThreatsFound: number | null;
  /** Threat summaries created by the just-completed scan only. */
  lastScanThreats: Threat[];
  scanError: string | null;
  scanQuotaError: { message: string; upgradeTo: string } | null;
  scanQuota: ScanQuotaState | null;
  isLoading: boolean;
  activeThreats: number;
  fakeAccounts: number;
  resolvedCount: number;
  leakedPasswords: number;
  /** ISO string or null — present while user is in a trial */
  trialEndsAt: string | null;
  /** "active" | "trialing" | "canceled" | "past_due" — null until first fetch */
  subscriptionStatus: "active" | "trialing" | "canceled" | "past_due" | null;
  /** true when survey modal should be shown (subscription just cancelled, not yet surveyed) */
  showCancellationSurvey: boolean;
  dismissCancellationSurvey: () => void;
  login: (name: string, email: string, userId?: string) => void;
  logout: (options?: { skipServerCleanup?: boolean }) => Promise<void>;
  completeOnboarding: () => void;
  startScan: () => void;
  checkScanQuota: () => Promise<void>;
  resolveThreat: (id: string, action?: string) => Promise<void>;
  refreshData: () => Promise<void>;
  addAccount: (platform: string, username: string, accessToken?: string, displayName?: string) => Promise<ConnectedAccount>;
  removeAccount: (id: string) => Promise<void>;
  updateAccount: (id: string, updates: { accessToken?: string; displayName?: string; followers?: number; platformUserId?: string }) => Promise<ConnectedAccount>;
  addIndexedPhotos: (photos: Array<{uri: string; base64?: string}>, source?: "camera_roll" | "account", accountId?: string) => void;
  removeIndexedPhoto: (id: string) => void;
  dismissReviewerSamplePhoto: () => Promise<boolean>;
  clearIndexedPhotos: () => Promise<void>;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mapSummaryToThreat(t: ThreatSummary): Threat {
  const detectedSignals =
    (t as ThreatSummary & { detectedSignals?: unknown }).detectedSignals;
  return {
    id: t.id,
    isSample: t.isSample,
    scanJobId: t.scanJobId,
    type: t.type as ThreatType,
    severity: t.severity,
    platform: (t.platform ?? null) as Platform,
    title: t.title,
    description: t.description,
    details: "",
    time: formatRelativeTime(t.createdAt),
    resolved: t.resolved,
    resolveAction: t.resolveAction ?? null,
    resolvedAt: t.resolvedAt ?? null,
    aiExplanation: "",
    threatScore: t.threatScore,
    suspiciousUsername: t.suspiciousUsername ?? "",
    matchedMediaCount: t.matchedMediaCount,
    evidenceCount: t.evidenceCount ?? 0,
    highConfidence: mapThreatSummaryHighConfidence(
      t.isSample === true,
      t.highConfidence,
      detectedSignals,
    ),
    evidence: [],
    scoreBreakdown: {
      mediaSimilarity: 0,
      contentReuse: 0,
      profileSimilarity: 0,
      bioSimilarity: 0,
      usernameSimilarity: 0,
      behavioral: 0,
    },
    detectedSignals: [],
  };
}

function mapAccountToConnected(a: AccountProfile): ConnectedAccount {
  return {
    id: a.id,
    platform: a.platform as Platform,
    username: a.username,
    followers: a.followers,
    verified: a.verified,
    needsReconnect: a.needsReconnect ?? false,
    photosIndexed: a.photosIndexed,
    captionsIndexed: a.captionsIndexed,
    lastSynced: a.lastSynced ?? null,
  };
}

function mapProfileToUser(
  profile: UserProfile,
  accounts: AccountProfile[]
): User {
  return {
    name: profile.name,
    email: profile.email,
    username: profile.username,
    avatarInitials: profile.avatarInitials,
    avatarUrl: (profile as any).avatarUrl ?? null,
    securityScore: profile.securityScore,
    scoreTrend: profile.scoreTrend,
    tier: (profile.tier as "free" | "pro" | "premium") ?? "free",
    monitored: profile.monitored,
    lastScan: profile.lastScan,
    nextScanDue: (profile as any).nextScanDue ?? null,
    totalPhotosIndexed: profile.totalPhotosIndexed,
    totalCaptionsIndexed: profile.totalCaptionsIndexed,
    reelsIndexed: profile.reelsIndexed,
    fingerprintUpdated: profile.fingerprintUpdated,
    connectedAccounts: accounts.map(mapAccountToConnected),
  };
}

const SURVEY_SHOWN_KEY = "rook:cancellation_survey_shown";
const REVIEWER_SAMPLE_DISMISSED_KEY = "rook:reviewer_sample_dismissed:";
const userPhotoStorageKeys = (userId: string) => ({
  photos: `indexedPhotos:${userId}`,
  threats: `localPhotoThreats:${userId}`,
});

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(DEFAULT_USER);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [reviewerDemo, setReviewerDemo] = useState<ReviewerDemoInfo | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  // isInitializing stays true until AsyncStorage has been read.
  // The tabs layout must not render any <Redirect> until this is false,
  // otherwise a returning user gets flash-redirected to /auth or /onboarding
  // before the stored values are loaded.
  const [isInitializing, setIsInitializing] = useState(true);
  const [isOnboardingReady, setIsOnboardingReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanCurrentStep, setScanCurrentStep] = useState<string | null>(null);
  const [lastScanThreatsFound, setLastScanThreatsFound] = useState<number | null>(null);
  const [lastScanThreats, setLastScanThreats] = useState<Threat[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanQuota, setScanQuota] = useState<ScanQuotaState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInFlightRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const lastRefreshedAtRef = useRef(0);
  // Proactive token refresh: only once per app session (not on every render).
  const hasRefreshedTokensRef = useRef(false);
  const accountSessionGuardRef = useRef(new AccountSessionGuard());
  const sessionGenerationRef = useRef(0);
  const refreshRunIdRef = useRef(0);
  const [indexedPhotos, setIndexedPhotos] = useState<IndexedPhoto[]>([]);
  const indexedPhotosRef = useRef<IndexedPhoto[]>([]);
  const [reviewerSample, setReviewerSample] = useState<{
    userId: string;
    photo: IndexedPhoto;
  } | null>(null);
  const reviewerSampleRequestRef = useRef(0);
  const reviewerSampleDismissedRef = useRef(new Set<string>());
  const reviewerDemoSampleDismissedRef = useRef(false);
  const [localPhotoThreats, setLocalPhotoThreats] = useState<Threat[]>([]);
  const localPhotoThreatsRef = useRef<Threat[]>([]);
  // hasSeenOnboarding is scoped per Clerk user id (see onboardingKey below) so
  // that signing out and back in with the SAME account never re-shows
  // onboarding, while a brand new account on the same device always does.
  const clerkUserIdRef = useRef<string | null>(null);
  const reviewerDemoWasActiveRef = useRef(false);
  const isCurrentAccountSession = useCallback(
    (generation: number, userId: string | null) =>
      accountSessionGuardRef.current.isCurrent(generation, userId) &&
      clerkUserIdRef.current === userId,
    [],
  );

  useEffect(() => subscribeReviewerDemo((info) => {
    const wasActive = reviewerDemoWasActiveRef.current;
    reviewerDemoWasActiveRef.current = info !== null;
    setReviewerDemo(info);
    if (info) {
      const hasPreviewMedia = Object.values(info.mediaByAccount).some((media) => media.items.length > 0);
      if (!wasActive) {
        // Hide the live account's device photos while the reviewer preview is
        // active, without modifying their persisted per-user photo store.
        setIndexedPhotos([]);
        indexedPhotosRef.current = [];
        setLocalPhotoThreats([]);
        localPhotoThreatsRef.current = [];
      }
      if (!info.consent.hasConsent || !hasPreviewMedia) {
        setReviewerSample(null);
        setIndexedPhotos([]);
        indexedPhotosRef.current = [];
      }
      setThreats(info.threats.map(mapSummaryToThreat));
      setScanQuota({
        ...info.quota,
        canScan: true,
        message: "Preview scans run locally on fictional sample data.",
      });
      setUser((previous) => ({
        ...previous,
        connectedAccounts: info.accounts.map(mapAccountToConnected),
        monitored: info.profileSummary.monitored,
        securityScore: info.profileSummary.securityScore,
        scoreTrend: info.profileSummary.scoreTrend,
        lastScan: info.profileSummary.lastScan,
        totalPhotosIndexed: info.profileSummary.totalPhotosIndexed,
        totalCaptionsIndexed: info.profileSummary.totalCaptionsIndexed,
        reelsIndexed: info.profileSummary.reelsIndexed,
        fingerprintUpdated: info.profileSummary.fingerprintUpdated,
      }));
      return;
    }
    if (wasActive) {
      // A token/account reset invalidates the preview authorization. Keep
      // push registration disabled until login runs the gate again.
      setIsLoggedIn(false);
      AsyncStorage.setItem("isLoggedIn", "false");
      setUser(DEFAULT_USER);
      setThreats([]);
      setLastScanThreats([]);
      setLastScanThreatsFound(null);
      setReviewerSample(null);
      setIndexedPhotos([]);
      indexedPhotosRef.current = [];
      setLocalPhotoThreats([]);
      localPhotoThreatsRef.current = [];
    }
  }), []);

  useEffect(() => subscribeReviewerDemoAuthorization((authorization) => {
    if (
      authorization.status !== "pending" &&
      authorization.status !== "unavailable"
    ) return;
    if (isReviewerDemoActive()) resetReviewerDemoSession();
    setIsLoggedIn(false);
    setIsOnboardingReady(false);
    setUser(DEFAULT_USER);
    setThreats([]);
    setLastScanThreats([]);
    setLastScanThreatsFound(null);
    setReviewerSample(null);
    setIndexedPhotos([]);
    indexedPhotosRef.current = [];
    setLocalPhotoThreats([]);
    localPhotoThreatsRef.current = [];
    setScanQuota(null);
    setScanQuotaError(null);
    setTrialEndsAt(null);
    setSubscriptionStatus(null);
    setShowCancellationSurvey(false);
    setIsScanning(false);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    if (scanSafetyTimerRef.current) clearTimeout(scanSafetyTimerRef.current);
    scanSafetyTimerRef.current = null;
    pollInFlightRef.current = false;
  }), []);

  useEffect(() => { indexedPhotosRef.current = indexedPhotos; }, [indexedPhotos]);
  useEffect(() => { localPhotoThreatsRef.current = localPhotoThreats; }, [localPhotoThreats]);

  const clearIndexedPhotos = useCallback(async () => {
    setIndexedPhotos([]);
    indexedPhotosRef.current = [];
    setLocalPhotoThreats([]);
    localPhotoThreatsRef.current = [];
    if (isReviewerDemoActive()) return;
    const userId = clerkUserIdRef.current;
    if (userId) {
      const keys = userPhotoStorageKeys(userId);
      await AsyncStorage.multiRemove([keys.photos, keys.threats]);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("isLoggedIn").then((loggedIn) => {
      // Do not restore the push-registration toggle before Clerk's current
      // identity and any reviewer-demo authorization have been checked.
      if (loggedIn !== null) setIsLoggedIn(false);
      // hasSeenOnboarding is deliberately NOT restored here — it is scoped per
      // Clerk user id and is loaded/set inside login() once we know who signed in.
      setIsInitializing(false);
    });
  }, []);

  const loadThreats = useCallback(async () => {
    const summaries = await listThreats();
    const mapped = summaries.map(mapSummaryToThreat);
    setThreats(mapped);
    return mapped;
  }, []);

  const loadReviewerSample = useCallback(async (
    summaries: ThreatSummary[],
    userId: string | null,
    generation: number,
    authTokenRevision: number,
  ) => {
    const requestId = ++reviewerSampleRequestRef.current;
    if (!userId) {
      setReviewerSample(null);
      return;
    }

    if (isReviewerDemoActive()) {
      if (reviewerDemoSampleDismissedRef.current) {
        setReviewerSample(null);
        return;
      }
      const demo = getReviewerDemoSnapshot();
      const sample = demo?.threats.find((threat) =>
        typeof threat.evidence.find((item) =>
          typeof item.yourPhotoUrl === "string" &&
          /^https:\/\//i.test(item.yourPhotoUrl)
        )?.yourPhotoUrl === "string"
      );
      const samplePhoto = sample?.evidence.find((item) =>
        typeof item.yourPhotoUrl === "string" &&
        /^https:\/\//i.test(item.yourPhotoUrl)
      )?.yourPhotoUrl;
      if (sample && typeof samplePhoto === "string") {
        setReviewerSample({
          userId,
          photo: {
            id: "review-demo-sample-photo",
            localUri: samplePhoto,
            addedAt: sample.createdAt,
            source: "review_example",
            isSample: true,
          },
        });
      } else {
        setReviewerSample(null);
      }
      return;
    }

    let sampleEvidence: { url: string; addedAt: string } | null = null;
    for (const summary of summaries) {
      if (!summary.isSample) continue;
      try {
        const detail = await getThreat(summary.id);
        if (!detail.isSample) continue;
        const evidence = detail.evidence.find(
          (item) =>
            typeof item.yourPhotoUrl === "string" &&
            /^https:\/\//i.test(item.yourPhotoUrl)
        );
        if (evidence?.yourPhotoUrl) {
          sampleEvidence = {
            url: evidence.yourPhotoUrl,
            addedAt: detail.createdAt,
          };
          break;
        }
      } catch {
        // A missing/locked sample detail must never be treated as a real photo.
      }
    }

    if (
      requestId !== reviewerSampleRequestRef.current ||
      !isCurrentAccountSession(generation, userId) ||
      clerkUserIdRef.current !== userId ||
      getApiAuthTokenRevision() !== authTokenRevision
    ) {
      return;
    }
    if (!sampleEvidence) {
      setReviewerSample(null);
      return;
    }

    const dismissalKey = `${REVIEWER_SAMPLE_DISMISSED_KEY}${userId}`;
    let dismissed = reviewerSampleDismissedRef.current.has(userId);
    if (!dismissed) {
      try {
        dismissed = (await AsyncStorage.getItem(dismissalKey)) === "true";
      } catch {
        return;
      }
    }
    if (
      requestId !== reviewerSampleRequestRef.current ||
      clerkUserIdRef.current !== userId
    ) {
      return;
    }
    if (dismissed) {
      reviewerSampleDismissedRef.current.add(userId);
      setReviewerSample(null);
      return;
    }

    setReviewerSample({
      userId,
      photo: {
        id: `reviewer_sample_${userId}`,
        localUri: sampleEvidence.url,
        addedAt: sampleEvidence.addedAt,
        source: "review_example",
      },
    });
  }, [isCurrentAccountSession]);

  const dismissReviewerSamplePhoto = useCallback(async (): Promise<boolean> => {
    const userId = clerkUserIdRef.current;
    if (!userId) return false;
    if (isReviewerDemoActive()) {
      reviewerDemoSampleDismissedRef.current = true;
      setReviewerSample(null);
      return true;
    }
    reviewerSampleDismissedRef.current.add(userId);
    setReviewerSample((current) =>
      current?.userId === userId ? null : current
    );
    try {
      await AsyncStorage.setItem(
        `${REVIEWER_SAMPLE_DISMISSED_KEY}${userId}`,
        "true"
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  const restoreUserPhotoData = useCallback(async (
    userId: string,
    generation: number,
    authTokenRevision: number,
  ) => {
    const keys = userPhotoStorageKeys(userId);
    try {
      const [storedPhotos, storedThreats] = await Promise.all([
        AsyncStorage.getItem(keys.photos),
        AsyncStorage.getItem(keys.threats),
      ]);
      if (
        !isCurrentAccountSession(generation, userId) ||
        getApiAuthTokenRevision() !== authTokenRevision ||
        isReviewerDemoActive()
      ) return;
      const photos: IndexedPhoto[] = storedPhotos ? JSON.parse(storedPhotos) : [];
      const restoredThreats: Threat[] = storedThreats
        ? (JSON.parse(storedThreats) as Threat[]).map((threat) => ({
            ...threat,
            isSample: false,
          }))
        : [];
      const realPhotos = photos.filter((photo) => photo.isSample !== true);
      setIndexedPhotos(realPhotos);
      indexedPhotosRef.current = realPhotos;
      setLocalPhotoThreats(restoredThreats);
      localPhotoThreatsRef.current = restoredThreats;
    } catch {
      // Corrupt or unavailable device-local data never blocks sign-in.
    }
  }, [isCurrentAccountSession]);

  const refreshData = useCallback(async (session?: {
    generation: number;
    userId: string;
    authTokenRevision: number;
  }) => {
    // Dedup guard: if a refresh is already in flight, skip this call entirely.
    // This prevents duplicate API bursts when multiple screens call refreshData
    // concurrently (e.g. login() + Alerts focus listener racing on startup).
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    const runId = ++refreshRunIdRef.current;
    const generation = session?.generation ?? sessionGenerationRef.current;
    const userId = session?.userId ?? clerkUserIdRef.current;
    const authTokenRevision = session?.authTokenRevision ?? getApiAuthTokenRevision();
    if (!userId) {
      isRefreshingRef.current = false;
      return;
    }
    const isCurrent = () =>
      isCurrentAccountSession(generation, userId) &&
      getApiAuthTokenRevision() === authTokenRevision;
    if (!isCurrent()) {
      isRefreshingRef.current = false;
      return;
    }
    const markAuthorizationUnavailable = () => {
      setReviewerDemoAuthorizationStatus(userId, "unavailable");
      if (isReviewerDemoActive()) resetReviewerDemoSession();
      setIsLoggedIn(false);
      setIsOnboardingReady(false);
      setUser(DEFAULT_USER);
      setThreats([]);
      setLastScanThreats([]);
      setLastScanThreatsFound(null);
      setReviewerSample(null);
      setIndexedPhotos([]);
      indexedPhotosRef.current = [];
      setLocalPhotoThreats([]);
      localPhotoThreatsRef.current = [];
      setScanQuota(null);
      setScanQuotaError(null);
      setTrialEndsAt(null);
      setSubscriptionStatus(null);
    };
    try {
      const attempt = async (): Promise<boolean> => {
        try {
          let profile = await getMe();
          if (!isCurrent()) return true;
          if (!isUsableProfile(profile)) {
            markAuthorizationUnavailable();
            return false;
          }

          let authorization = getReviewerDemoAuthorizationState();
          if (authorization.accountKey !== userId) {
            if (isReviewerDemoActive()) resetReviewerDemoSession();
            beginReviewerDemoAuthorization(userId);
            authorization = getReviewerDemoAuthorizationState();
          }
          if (
            authorization.status === "pending" ||
            authorization.status === "unavailable" ||
            (authorization.status === "demo" && !isReviewerDemoActive())
          ) {
            setReviewerDemoAuthorizationStatus(userId, "pending");
            const decision = await authorizeReviewerDemo();
            if (!isCurrent()) return true;
            if (decision.status === "demo") {
              activateReviewerDemo(decision.info, userId);
            } else if (decision.status === "live") {
              setReviewerDemoAuthorizationStatus(userId, "live");
            } else {
              markAuthorizationUnavailable();
              return false;
            }
          }
          if (!isCurrent()) return true;
          authorization = getReviewerDemoAuthorizationState();
          if (
            authorization.accountKey !== userId ||
            (authorization.status !== "live" &&
              !(authorization.status === "demo" && isReviewerDemoActive()))
          ) {
            markAuthorizationUnavailable();
            return false;
          }
          if (isReviewerDemoActive()) profile = await getMe();
          if (!isCurrent()) return true;
          if (!isUsableProfile(profile)) {
            markAuthorizationUnavailable();
            return false;
          }

          const hasAcceptedLegal =
            Boolean(profile.termsAcceptedAt || profile.termsVersion) &&
            Boolean(profile.ageConfirmedAt);
          if (!hasAcceptedLegal) return true;
          setIsLoggedIn(true);
          setIsOnboardingReady(true);

          // Keep consent reconciliation independent of the rest of the
          // dashboard requests, so an unrelated API failure cannot skip the
          // local photo cleanup after the server confirms consent is inactive.
          const photoConsent = await getPhotoConsent().catch(() => null);
          if (!isCurrent()) return true;
          if (photoConsent && !photoConsent.hasConsent) {
            await clearIndexedPhotos();
            if (!isCurrent()) return true;
          }

          const [accounts, summaries, quotaState, sub] = await Promise.all([
            getAccounts(),
            listThreats(),
            getScanQuotaState().catch(() => null),
            getSubscription().catch(() => null),
          ]);
          if (!isCurrent()) return true;
          setUser(mapProfileToUser(profile, accounts));
          setThreats(summaries.map(mapSummaryToThreat));
          void loadReviewerSample(summaries, userId, generation, authTokenRevision);
          // Proactively show quota error banner if the free monthly scan is already used.
          // This surfaces immediately on app open rather than requiring a failed scan attempt.
          if (quotaState && !quotaState.canScan && quotaState.message) {
            setScanQuotaError({ message: quotaState.message, upgradeTo: quotaState.upgradeTo ?? "premium" });
          }
           if (quotaState) setScanQuota(quotaState);
          // Subscription state for trial banner and cancellation survey
          if (sub) {
            setTrialEndsAt(sub.trialEndsAt ?? null);
            setSubscriptionStatus(sub.status as "active" | "trialing" | "canceled" | "past_due");
            // Show cancellation survey once after subscription lapses
            if (sub.status === "canceled") {
              AsyncStorage.getItem(SURVEY_SHOWN_KEY).then((shown) => {
                if (shown !== "true" && isCurrent()) setShowCancellationSurvey(true);
              }).catch(() => {});
            }
          }
          // The server is the durable source of truth for onboarding completion
          // (onboardingAnswers persisted in the DB). Device-local AsyncStorage
          // flags can be lost on reinstall or stale after account deletion, so
          // once we hear from the server that onboarding is done, trust it and
          // sync the local cache to match (never downgrade an already-true local flag).
          if (profile.onboardingCompleted) {
            setHasSeenOnboarding(true);
            AsyncStorage.setItem(`hasSeenOnboarding:${userId}`, "true");
          }
          lastRefreshedAtRef.current = Date.now();
          return true;
        } catch {
          if (!isCurrent()) return true;
          const authorization = getReviewerDemoAuthorizationState();
          if (authorization.accountKey === userId && authorization.status === "pending") {
            markAuthorizationUnavailable();
          }
          return false;
        }
      };

      if (await attempt()) return;

      // Retry with exponential backoff — handles the race where Clerk's token
      // is not yet available on the very first call after login().
      const delays = [1000, 2500];
      for (const delay of delays) {
        await new Promise((r) => setTimeout(r, delay));
        if (!isCurrent()) return;
        if (await attempt()) return;
      }
      // Silently fail after all retries — user stays on empty default state.
    } finally {
      if (runId === refreshRunIdRef.current) isRefreshingRef.current = false;
    }
  }, [clearIndexedPhotos, isCurrentAccountSession, loadReviewerSample]);

  // NOTE: Do NOT trigger refreshData() from the isLoggedIn useEffect.
  // The AsyncStorage restore of isLoggedIn happens before setApiAuthToken() is called
  // from _layout.tsx, so any API call made here would have no Bearer token and would
  // fall back to the demo user. Data loading is triggered explicitly inside login().

  const login = useCallback((name: string, email: string, userId?: string) => {
    const nextUserId = userId ?? null;
    const generation = accountSessionGuardRef.current.begin(nextUserId);
    sessionGenerationRef.current = generation;
    const accountChanged = clerkUserIdRef.current !== nextUserId;
    const previousAuthorization = getReviewerDemoAuthorizationState();
    const wasAuthorizedForAccount =
      previousAuthorization.accountKey === nextUserId &&
      (previousAuthorization.status === "live" ||
        (previousAuthorization.status === "demo" && isReviewerDemoActive()));

    if (accountChanged || !wasAuthorizedForAccount) {
      if (accountChanged || isReviewerDemoActive()) resetReviewerDemoSession();
      beginReviewerDemoAuthorization(nextUserId);
      reviewerDemoSampleDismissedRef.current = false;
      reviewerSampleRequestRef.current += 1;
      setReviewerSample(null);
      setUser(DEFAULT_USER);
      setThreats([]);
      setLastScanThreats([]);
      setLastScanThreatsFound(null);
      setIndexedPhotos([]);
      indexedPhotosRef.current = [];
      setLocalPhotoThreats([]);
      localPhotoThreatsRef.current = [];
      setScanQuota(null);
      setScanQuotaError(null);
      setTrialEndsAt(null);
      setSubscriptionStatus(null);
      setShowCancellationSurvey(false);
      if (accountChanged) setHasSeenOnboarding(false);
      setIsScanning(false);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
      if (scanSafetyTimerRef.current) clearTimeout(scanSafetyTimerRef.current);
      scanSafetyTimerRef.current = null;
      pollInFlightRef.current = false;
      isRefreshingRef.current = false;
      refreshRunIdRef.current += 1;
      if (accountChanged) hasRefreshedTokensRef.current = false;
    }
    setIsLoggedIn(false);
    setIsLoading(true);
    clerkUserIdRef.current = nextUserId;
    reviewerSampleRequestRef.current += 1;
    setReviewerSample(null);
    setIsOnboardingReady(false);
    if (!nextUserId) setHasSeenOnboarding(false);

    let protectedApiReady = false;
    let legalAccepted = false;
    const authTokenRevision = getApiAuthTokenRevision();
    const isCurrent = () =>
      isCurrentAccountSession(generation, nextUserId) &&
      getApiAuthTokenRevision() === authTokenRevision;
    const session = nextUserId
      ? { generation, userId: nextUserId, authTokenRevision }
      : undefined;
    const load = (async () => {
      if (!nextUserId || !session) return;

      let profile: UserProfile | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!isCurrent()) return;
        try {
          profile = await getMe();
          if (!isCurrent()) return;
          if (!isUsableProfile(profile)) {
            setReviewerDemoAuthorizationStatus(nextUserId, "unavailable");
            if (isReviewerDemoActive()) resetReviewerDemoSession();
            profile = null;
            throw new Error("The authenticated profile response was invalid.");
          }

          let authorization = getReviewerDemoAuthorizationState();
          if (authorization.accountKey !== nextUserId) {
            beginReviewerDemoAuthorization(nextUserId);
            authorization = getReviewerDemoAuthorizationState();
          }
          if (
            authorization.status === "pending" ||
            authorization.status === "unavailable" ||
            (authorization.status === "demo" && !isReviewerDemoActive())
          ) {
            setReviewerDemoAuthorizationStatus(nextUserId, "pending");
            const decision = await authorizeReviewerDemo();
            if (!isCurrent()) return;
            if (decision.status === "demo") {
              activateReviewerDemo(decision.info, nextUserId);
            } else if (decision.status === "live") {
              setReviewerDemoAuthorizationStatus(nextUserId, "live");
            } else {
              setReviewerDemoAuthorizationStatus(nextUserId, "unavailable");
              if (isReviewerDemoActive()) resetReviewerDemoSession();
              throw new Error("Reviewer authorization could not be verified.");
            }
          }

          authorization = getReviewerDemoAuthorizationState();
          if (
            authorization.accountKey !== nextUserId ||
            (authorization.status !== "live" &&
              !(authorization.status === "demo" && isReviewerDemoActive()))
          ) {
            profile = null;
            throw new Error("Account authorization is unavailable.");
          }
          legalAccepted =
            Boolean(profile.termsAcceptedAt || profile.termsVersion) &&
            Boolean(profile.ageConfirmedAt);
          if (!legalAccepted) return;

          const cachedOnboarding = await AsyncStorage.getItem(`hasSeenOnboarding:${nextUserId}`);
          if (!isCurrent()) return;
          if (cachedOnboarding === "true") {
            setHasSeenOnboarding(true);
            setIsOnboardingReady(true);
          }

          // Device photos and provider tokens are live-account effects. Never
          // restore or refresh them while preview authorization is pending or unavailable.
          if (authorization.status === "live") {
            await restoreUserPhotoData(nextUserId, generation, authTokenRevision);
            if (!isCurrent()) return;
          }

          // Clerk claim synchronization remains live for normal accounts, but
          // never writes profile changes from reviewer preview.
          if (authorization.status === "live" && (name || email)) {
            const updates: { name?: string; email?: string } = {};
            const normalizedName = name.trim();
            const normalizedEmail = email.trim();
            const currentEmail =
              typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
            if (normalizedName && normalizedName !== profile.name) updates.name = normalizedName;
            if (normalizedEmail && normalizedEmail.toLowerCase() !== currentEmail) {
              updates.email = normalizedEmail;
            }
            if (Object.keys(updates).length > 0) {
              await updateMe(updates);
              if (!isCurrent()) return;
            }
          }

          protectedApiReady = true;
          break;
        } catch {
          if (!isCurrent()) return;
          const authorization = getReviewerDemoAuthorizationState();
          if (
            authorization.accountKey === nextUserId &&
            authorization.status === "pending"
          ) {
            setReviewerDemoAuthorizationStatus(nextUserId, "unavailable");
          }
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 1000 : 2500));
            if (!isCurrent()) return;
            const currentAuthorization = getReviewerDemoAuthorizationState();
            if (
              currentAuthorization.accountKey === nextUserId &&
              currentAuthorization.status === "unavailable"
            ) {
              setReviewerDemoAuthorizationStatus(nextUserId, "pending");
            }
          }
        }
      }

      if (!protectedApiReady || !isCurrent()) return;
      setIsLoggedIn(true);
      await refreshData(session);
    })();

    load.finally(() => {
      if (!isCurrent()) return;
      const authorization = getReviewerDemoAuthorizationState();
      const stillAuthorized =
        authorization.accountKey === nextUserId &&
        (authorization.status === "live" ||
          (authorization.status === "demo" && isReviewerDemoActive()));
      if (protectedApiReady && stillAuthorized && authorization.status === "live" &&
          legalAccepted && !hasRefreshedTokensRef.current) {
        hasRefreshedTokensRef.current = true;
        refreshAccountTokens().catch(() => {});
      }
      if (protectedApiReady && stillAuthorized) setIsOnboardingReady(true);
      setIsLoading(false);
    }).catch(() => {});
  }, [isCurrentAccountSession, refreshData, restoreUserPhotoData]);

  const logout = useCallback(async (options?: { skipServerCleanup?: boolean }) => {
    const ownerId = clerkUserIdRef.current;
    const generationAtStart = sessionGenerationRef.current;
    const authorization = getReviewerDemoAuthorizationState();
    let capturedDevice: CapturedDevicePushToken | null = null;
    let pinnedCleanup: PinnedPushTokenCleanup | null = null;

    if (
      shouldCaptureLiveLogoutCleanup(
        authorization,
        ownerId,
        options?.skipServerCleanup === true,
      )
    ) {
      try {
        capturedDevice = await captureCurrentDevicePushToken(ownerId);
        if (
          capturedDevice &&
          sessionGenerationRef.current === generationAtStart &&
          clerkUserIdRef.current === ownerId
        ) {
          pinnedCleanup = await capturePinnedPushTokenCleanup(ownerId, capturedDevice);
        }
      } catch {
        // Logout remains best-effort if a device token or old bearer cannot be captured.
      }
    }

    // A different login/account switch may have completed while token capture
    // was pending. Never invalidate that newer session from an old logout.
    if (
      sessionGenerationRef.current !== generationAtStart ||
      clerkUserIdRef.current !== ownerId
    ) return;

    sessionGenerationRef.current = accountSessionGuardRef.current.invalidate();
    refreshRunIdRef.current += 1;
    isRefreshingRef.current = false;
    invalidateApiAuthToken(ownerId);
    beginReviewerDemoAuthorization(null);
    clerkUserIdRef.current = null;
    resetReviewerDemoSession();
    reviewerDemoSampleDismissedRef.current = false;
    setIsLoggedIn(false);
    setIsLoading(false);
    setIsScanning(false);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    if (scanSafetyTimerRef.current) clearTimeout(scanSafetyTimerRef.current);
    scanSafetyTimerRef.current = null;
    pollInFlightRef.current = false;
    setUser(DEFAULT_USER);
    setThreats([]);
    setLastScanThreats([]);
    setLastScanThreatsFound(null);
    setIndexedPhotos([]);
    indexedPhotosRef.current = [];
    reviewerSampleRequestRef.current += 1;
    setReviewerSample(null);
    setLocalPhotoThreats([]);
    localPhotoThreatsRef.current = [];
    setHasSeenOnboarding(false);
    setIsOnboardingReady(false);
    setScanQuota(null);
    setScanQuotaError(null);
    setTrialEndsAt(null);
    setSubscriptionStatus(null);
    setShowCancellationSurvey(false);
    hasRefreshedTokensRef.current = false;
    AsyncStorage.setItem("isLoggedIn", "false");

    // The request uses the captured owner-bound bearer and the exact device
    // token, never the global getter that may now belong to another account.
    if (pinnedCleanup && capturedDevice) {
      try {
        await executePinnedPushTokenCleanup(pinnedCleanup);
        await forgetCapturedDevicePushToken(capturedDevice);
      } catch {
        // Keep local token state for a later best-effort cleanup attempt.
      }
    }
  }, []);

  const completeOnboarding = useCallback(() => {
    setHasSeenOnboarding(true);
    const userId = clerkUserIdRef.current;
    AsyncStorage.setItem(userId ? `hasSeenOnboarding:${userId}` : "hasSeenOnboarding", "true");
  }, []);

  const addIndexedPhotos = useCallback((
    photos: Array<{uri: string; base64?: string}>,
    source: "camera_roll" | "account" = "camera_roll",
    accountId?: string
  ) => {
    const isSample = isReviewerDemoActive();
    const newPhotos: IndexedPhoto[] = photos.map(({ uri, base64 }) => ({
      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      localUri: uri,
      // Imported reviewer-demo photos stay in memory and are never sent to
      // image search, scan processing, or device storage.
      base64: isSample ? undefined : base64,
      addedAt: new Date().toISOString(),
      source,
      accountId,
      ...(isSample ? { isSample: true } : {}),
    }));
    setIndexedPhotos((prev) => {
      const next = [...prev, ...newPhotos];
      const userId = clerkUserIdRef.current;
      if (!isSample && userId) {
        AsyncStorage.setItem(userPhotoStorageKeys(userId).photos, JSON.stringify(next));
      }
      indexedPhotosRef.current = next;
      return next;
    });
  }, []);

  const removeIndexedPhoto = useCallback((id: string) => {
    const isSample = isReviewerDemoActive();
    setIndexedPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const userId = clerkUserIdRef.current;
      if (!isSample && userId) {
        AsyncStorage.setItem(userPhotoStorageKeys(userId).photos, JSON.stringify(next));
      }
      indexedPhotosRef.current = next;
      return next;
    });
    setLocalPhotoThreats((prev) => {
      const next = prev.filter((t) => !t.id.includes(id));
      const userId = clerkUserIdRef.current;
      if (!isSample && userId) {
        AsyncStorage.setItem(userPhotoStorageKeys(userId).threats, JSON.stringify(next));
      }
      localPhotoThreatsRef.current = next;
      return next;
    });
  }, []);

  const [scanQuotaError, setScanQuotaError] = useState<{ message: string; upgradeTo: string } | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<"active" | "trialing" | "canceled" | "past_due" | null>(null);
  const [showCancellationSurvey, setShowCancellationSurvey] = useState(false);

  const dismissCancellationSurvey = useCallback(() => {
    setShowCancellationSurvey(false);
    AsyncStorage.setItem(SURVEY_SHOWN_KEY, "true").catch(() => {});
  }, []);

  const checkScanQuota = useCallback(async () => {
    try {
      const state = await getScanQuotaState();
      setScanQuota(state);
      if (!state.canScan && state.message) {
        setScanQuotaError({ message: state.message, upgradeTo: state.upgradeTo ?? "premium" });
      } else if (state.canScan) {
        setScanQuotaError(null);
      }
    } catch {
      // The scan endpoint remains authoritative; leave the last known state
      // visible instead of falsely claiming an allowance is available.
    }
  }, []);

  const startScan = useCallback(async () => {
    const scanUserId = clerkUserIdRef.current;
    const scanGeneration = sessionGenerationRef.current;
    const scanAuthTokenRevision = getApiAuthTokenRevision();
    const scanAuthorization = getReviewerDemoAuthorizationState();
    const isCurrentScanSession = () => {
      const authorization = getReviewerDemoAuthorizationState();
      return Boolean(scanUserId) &&
        isCurrentAccountSession(scanGeneration, scanUserId) &&
        getApiAuthTokenRevision() === scanAuthTokenRevision &&
        authorization.accountKey === scanUserId &&
        (authorization.status === "live" ||
          (authorization.status === "demo" && isReviewerDemoActive()));
    };
    if (
      isScanning ||
      !isLoggedIn ||
      !scanUserId ||
      scanAuthorization.accountKey !== scanUserId ||
      (scanAuthorization.status !== "live" &&
        !(scanAuthorization.status === "demo" && isReviewerDemoActive()))
    ) return;
    setScanQuotaError(null);
    setScanError(null);
    setIsScanning(true);
    setScanProgress(0);
    setScanCurrentStep(null);
    setLastScanThreats([]);
    setLastScanThreatsFound(null);

    // Safety: never leave isScanning stuck true for more than 3 minutes
    const safetyTimer = setTimeout(() => {
      if (!isCurrentScanSession()) return;
      setIsScanning(false);
      setScanCurrentStep(null);
      setScanError("The scan took too long to complete. Please check your connection and try again.");
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      scanSafetyTimerRef.current = null;
    }, 3 * 60 * 1000);
    scanSafetyTimerRef.current = safetyTimer;

    // Snapshot monitored photos at scan start so the list can't change mid-scan
    // Keep client-side reverse-image searches aligned with the plan's image
    // allowance. Server-side scan analysis independently enforces the same
    // cap for account media.
    // Consent can be withdrawn from Privacy while the Scan tab remains
    // mounted. Re-check the server flag at scan time so cached local photos
    // can never trigger photo processing after withdrawal.
    let photosSnapshot: IndexedPhoto[] = [];
    let photoConsentActive = true;
    if (isReviewerDemoActive()) {
      // A demo scan operates only on the server-authorized sample findings.
      // Device photos are deliberately excluded from every scan/search path.
      photoConsentActive = false;
    } else {
      try {
        const consent = await getPhotoConsent();
        photoConsentActive = consent.hasConsent;
        if (photoConsentActive) {
          photosSnapshot = user.tier === "free"
            ? indexedPhotosRef.current.slice(0, 1)
            : [...indexedPhotosRef.current];
        }
      } catch {
        // Fail closed for photo processing when consent cannot be confirmed.
        photoConsentActive = false;
      }
    }
    if (!isCurrentScanSession()) {
      clearTimeout(safetyTimer);
      if (scanSafetyTimerRef.current === safetyTimer) scanSafetyTimerRef.current = null;
      return;
    }
    if (!isReviewerDemoActive() && !photoConsentActive && indexedPhotosRef.current.length > 0) {
      setScanError("Photo monitoring is paused until you enable consent in Privacy & Data. Account and username monitoring will continue.");
    }

    // Fire Vision searches for all monitored photos in parallel with the backend scan.
    // Each photo is searched independently; failures are non-fatal.
    const photoScanPromise: Promise<void> = photosSnapshot.length > 0
      ? Promise.allSettled(
          photosSnapshot.map(async (photo) => {
            if (photo.base64) {
              await reverseImageSearch({ imageBase64: photo.base64, localUri: photo.localUri });
            } else if (photo.localUri.startsWith("http")) {
              await reverseImageSearch({ imageUrl: photo.localUri });
            }
          })
        ).then(() => {})
      : Promise.resolve();

    try {
      // Normal app scans use the server cache. This preserves fresh-enough
      // discoveries while avoiding unnecessary external lookups.
      const job = await apiStartScan();
      if (!isCurrentScanSession()) {
        clearTimeout(safetyTimer);
        if (scanSafetyTimerRef.current === safetyTimer) scanSafetyTimerRef.current = null;
        return;
      }

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      const handlePollResult = async () => {
        if (!isCurrentScanSession()) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          clearTimeout(safetyTimer);
          if (scanSafetyTimerRef.current === safetyTimer) scanSafetyTimerRef.current = null;
          pollInFlightRef.current = false;
          return;
        }
        if (pollInFlightRef.current) return;
        pollInFlightRef.current = true;
        try {
          const status = await getScanStatus(job.id);
          if (!isCurrentScanSession()) return;
          setScanProgress(status.progress);
          if (status.currentStep) {
            setScanCurrentStep(status.currentStep);
          }

          if (status.status === "failed") {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            clearTimeout(safetyTimer);
            if (scanSafetyTimerRef.current === safetyTimer) scanSafetyTimerRef.current = null;
            setIsScanning(false);
            setScanProgress(0);
            setScanCurrentStep(null);
            setScanError("The scan could not be completed. Please try again.");
            return;
          }

          if (status.status === "completed") {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            clearTimeout(safetyTimer);

            // Wait for any in-flight photo scans before the final data refresh
            await photoScanPromise.catch(() => {});
            if (!isCurrentScanSession()) return;

            setScanProgress(100);
            setScanCurrentStep(null);
            const scanResultSummaries = await getScanResults(job.id);
            if (!isCurrentScanSession()) return;
            const scanThreats = scanResultSummaries.map(mapSummaryToThreat);
            setLastScanThreats(scanThreats);
            setLastScanThreatsFound(scanThreats.length);
            // Refresh historical Alerts separately. A dashboard refresh failure
            // must not erase or relabel the successfully loaded scan result.
            await loadThreats().catch(() => {});
            if (!isCurrentScanSession()) return;
            try {
              const [profile, accounts] = await Promise.all([getMe(), getAccounts()]);
              if (!isCurrentScanSession()) return;
              setUser(mapProfileToUser(profile, accounts));
            } catch {
              // The scan-scoped result is already available; keep existing profile data.
            }
            if (!isCurrentScanSession()) return;
            setIsScanning(false);
            getScanQuotaState().then((quota) => {
              if (isCurrentScanSession()) setScanQuota(quota);
            }).catch(() => {});

            const allActive = scanThreats.filter((t) => !t.resolved);
            const activeCount = allActive.length;
            if (isCurrentScanSession() && !isReviewerDemoActive()) {
              scheduleScanCompleteNotification(activeCount).catch(() => {});
              const highSeverity = allActive.filter((t) => t.severity === "high");
              if (highSeverity.length > 0 && highSeverity[0]) {
                scheduleThreatNotification(highSeverity[0].title, highSeverity[0].id).catch(() => {});
              }
            }
          }
        } catch {
          if (!isCurrentScanSession()) return;
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          clearTimeout(safetyTimer);
          if (scanSafetyTimerRef.current === safetyTimer) scanSafetyTimerRef.current = null;
          setIsScanning(false);
          setScanCurrentStep(null);
          setScanError("We could not check the scan status. Please check your connection and try again.");
        } finally {
          pollInFlightRef.current = false;
        }
      };

      // Immediate first poll so progress appears without waiting a full interval
      handlePollResult();
      pollTimerRef.current = setInterval(handlePollResult, 400);
    } catch (err) {
      clearTimeout(safetyTimer);
      if (scanSafetyTimerRef.current === safetyTimer) scanSafetyTimerRef.current = null;
      if (!isCurrentScanSession()) return;
      setIsScanning(false);
      setScanCurrentStep(null);
      if (err instanceof ScanQuotaError) {
        setScanQuotaError({ message: err.userMessage, upgradeTo: err.upgradeTo });
      } else {
        setScanError(err instanceof Error ? err.message : "The scan could not be started. Please try again.");
      }
    }
  }, [isCurrentAccountSession, isLoggedIn, isScanning, loadThreats, user.tier]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (scanSafetyTimerRef.current) clearTimeout(scanSafetyTimerRef.current);
    };
  }, []);

  const resolveThreat = useCallback(async (id: string, action?: string): Promise<void> => {
    // Local photo threats are resolved in client state only
    if (id.startsWith("local_photo_")) {
      setLocalPhotoThreats((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, resolved: true } : t));
        const userId = clerkUserIdRef.current;
        if (userId && !isReviewerDemoActive()) {
          AsyncStorage.setItem(userPhotoStorageKeys(userId).threats, JSON.stringify(next));
        }
        localPhotoThreatsRef.current = next;
        return next;
      });
      return;
    }
    setThreats((prev) =>
      prev.map((t) => (t.id === id ? { ...t, resolved: true } : t))
    );
    try {
      await apiResolveThreat(id, action);
    } catch (err) {
      setThreats((prev) =>
        prev.map((t) => (t.id === id ? { ...t, resolved: false } : t))
      );
      throw err;
    }
  }, []);

  const addAccount = useCallback(async (platform: string, username: string, accessToken?: string, displayName?: string): Promise<ConnectedAccount> => {
    const account = await apiAddAccount(platform, username, accessToken, displayName);
    const mapped = mapAccountToConnected(account);
    setUser((prev) => ({
      ...prev,
      connectedAccounts: [...prev.connectedAccounts, mapped],
      monitored: prev.connectedAccounts.length + 1,
    }));
    return mapped;
  }, []);

  const removeAccount = useCallback(async (id: string): Promise<void> => {
    setUser((prev) => ({
      ...prev,
      connectedAccounts: prev.connectedAccounts.filter((a) => a.id !== id),
      monitored: Math.max(0, prev.connectedAccounts.length - 1),
    }));
    try {
      await apiRemoveAccount(id);
    } catch {
      const accounts = await getAccounts();
      const profile = await getMe();
      setUser(mapProfileToUser(profile, accounts));
    }
  }, []);

  const updateAccount = useCallback(async (id: string, updates: { accessToken?: string; displayName?: string; followers?: number; platformUserId?: string }): Promise<ConnectedAccount> => {
    const account = await apiUpdateAccount(id, updates);
    const mapped = mapAccountToConnected(account);
    setUser((prev) => ({
      ...prev,
      connectedAccounts: prev.connectedAccounts.map((a) => a.id === id ? mapped : a),
    }));
    return mapped;
  }, []);

  // Merge API threats with locally-generated photo threats, de-duped by id
  const apiThreatIds = new Set(threats.map((t) => t.id));
  const mergedThreats = [
    ...threats,
    ...localPhotoThreats.filter((t) => !apiThreatIds.has(t.id)),
  ];

  const activeThreats = mergedThreats.filter(
    (t) => !t.resolved
  ).length;
  const fakeAccounts = mergedThreats.filter(
    (t) =>
      !t.resolved &&
      (t.type === "fake_account" ||
        t.type === "impersonator" ||
        t.type === "stolen_photo")
  ).length;
  const leakedPasswords = mergedThreats.filter(
    (t) => !t.resolved && t.type === "leaked_password"
  ).length;
  const resolvedCount = mergedThreats.filter((t) => t.resolved).length;

  return (
    <AppContext.Provider
      value={{
        user,
        threats: mergedThreats,
        indexedPhotos,
        reviewerSamplePhoto:
          reviewerSample?.userId === clerkUserIdRef.current
            ? reviewerSample.photo
            : null,
        isLoggedIn,
        reviewerDemo,
        isReviewerDemo: reviewerDemo !== null,
        hasSeenOnboarding,
        isInitializing,
        isOnboardingReady,
        isScanning,
        scanProgress,
        scanCurrentStep,
        lastScanThreatsFound,
        lastScanThreats,
        scanError,
        isLoading,
        activeThreats,
        fakeAccounts,
        resolvedCount,
        leakedPasswords,
        trialEndsAt,
        subscriptionStatus,
        showCancellationSurvey,
        dismissCancellationSurvey,
        login,
        logout,
        completeOnboarding,
        startScan,
        checkScanQuota,
        scanQuotaError,
        scanQuota,
        resolveThreat,
        refreshData,
        addAccount,
        removeAccount,
        updateAccount,
        addIndexedPhotos,
        removeIndexedPhoto,
        dismissReviewerSamplePhoto,
        clearIndexedPhotos,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
