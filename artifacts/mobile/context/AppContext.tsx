import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { scheduleScanCompleteNotification, scheduleThreatNotification } from "@/hooks/useNotifications";
import {
  getMe,
  getAccounts,
  listThreats,
  startScan as apiStartScan,
  getScanStatus,
  getLatestScan,
  getScanQuotaState,
  getSubscription,
  resolveThreat as apiResolveThreat,
  addAccount as apiAddAccount,
  removeAccount as apiRemoveAccount,
  updateAccount as apiUpdateAccount,
  updateMe,
  reverseImageSearch,
  refreshAccountTokens,
  type UserProfile,
  type AccountProfile,
  type ThreatSummary,
  ScanQuotaError,
} from "@/lib/api";

export interface IndexedPhoto {
  id: string;
  localUri: string;
  base64?: string;
  addedAt: string;
  source: "camera_roll" | "account";
  accountId?: string;
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
  isLoggedIn: boolean;
  hasSeenOnboarding: boolean;
  /** true while AsyncStorage is being read on first mount — gates all route redirects */
  isInitializing: boolean;
  /** true once the per-user hasSeenOnboarding flag has been loaded after login — gates the onboarding redirect specifically */
  isOnboardingReady: boolean;
  isScanning: boolean;
  scanProgress: number;
  scanCurrentStep: string | null;
  scanQuotaError: { message: string; upgradeTo: string } | null;
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
  logout: () => void;
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
  return {
    id: t.id,
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
    highConfidence: t.highConfidence ?? false,
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

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(DEFAULT_USER);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
  const [isLoading, setIsLoading] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRefreshingRef = useRef(false);
  const lastRefreshedAtRef = useRef(0);
  // Proactive token refresh: only once per app session (not on every render).
  const hasRefreshedTokensRef = useRef(false);
  const [indexedPhotos, setIndexedPhotos] = useState<IndexedPhoto[]>([]);
  const indexedPhotosRef = useRef<IndexedPhoto[]>([]);
  const [localPhotoThreats, setLocalPhotoThreats] = useState<Threat[]>([]);
  const localPhotoThreatsRef = useRef<Threat[]>([]);
  // hasSeenOnboarding is scoped per Clerk user id (see onboardingKey below) so
  // that signing out and back in with the SAME account never re-shows
  // onboarding, while a brand new account on the same device always does.
  const clerkUserIdRef = useRef<string | null>(null);

  useEffect(() => { indexedPhotosRef.current = indexedPhotos; }, [indexedPhotos]);
  useEffect(() => { localPhotoThreatsRef.current = localPhotoThreats; }, [localPhotoThreats]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("isLoggedIn"),
      AsyncStorage.getItem("indexedPhotos"),
      AsyncStorage.getItem("localPhotoThreats"),
    ]).then(([loggedIn, storedPhotos, storedLocalThreats]) => {
      if (loggedIn !== null) setIsLoggedIn(loggedIn === "true");
      // hasSeenOnboarding is deliberately NOT restored here — it is scoped per
      // Clerk user id and is loaded/set inside login() once we know who signed in.
      if (storedPhotos) {
        try {
          const parsed: IndexedPhoto[] = JSON.parse(storedPhotos);
          setIndexedPhotos(parsed);
          indexedPhotosRef.current = parsed;
        } catch { /* ignore corrupt storage */ }
      }
      if (storedLocalThreats) {
        try {
          const parsed: Threat[] = JSON.parse(storedLocalThreats);
          setLocalPhotoThreats(parsed);
          localPhotoThreatsRef.current = parsed;
        } catch { /* ignore corrupt storage */ }
      }
      setIsInitializing(false);
    });
  }, []);

  const loadThreats = useCallback(async () => {
    const summaries = await listThreats();
    const mapped = summaries.map(mapSummaryToThreat);
    setThreats(mapped);
    return mapped;
  }, []);

  const refreshData = useCallback(async () => {
    // Dedup guard: if a refresh is already in flight, skip this call entirely.
    // This prevents duplicate API bursts when multiple screens call refreshData
    // concurrently (e.g. login() + Alerts focus listener racing on startup).
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const attempt = async (): Promise<boolean> => {
        try {
          const [profile, accounts, summaries, quotaState, sub] = await Promise.all([
            getMe(),
            getAccounts(),
            listThreats(),
            getScanQuotaState().catch(() => null),
            getSubscription().catch(() => null),
          ]);
          setUser(mapProfileToUser(profile, accounts));
          setThreats(summaries.map(mapSummaryToThreat));
          // Proactively show quota error banner if the free monthly scan is already used.
          // This surfaces immediately on app open rather than requiring a failed scan attempt.
          if (quotaState && !quotaState.canScan && quotaState.message) {
            setScanQuotaError({ message: quotaState.message, upgradeTo: quotaState.upgradeTo ?? "premium" });
          }
          // Subscription state for trial banner and cancellation survey
          if (sub) {
            setTrialEndsAt(sub.trialEndsAt ?? null);
            setSubscriptionStatus(sub.status as "active" | "trialing" | "canceled" | "past_due");
            // Show cancellation survey once after subscription lapses
            if (sub.status === "canceled") {
              AsyncStorage.getItem(SURVEY_SHOWN_KEY).then((shown) => {
                if (shown !== "true") setShowCancellationSurvey(true);
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
            const userId = clerkUserIdRef.current;
            AsyncStorage.setItem(userId ? `hasSeenOnboarding:${userId}` : "hasSeenOnboarding", "true");
          }
          lastRefreshedAtRef.current = Date.now();
          return true;
        } catch {
          return false;
        }
      };

      if (await attempt()) return;

      // Retry with exponential backoff — handles the race where Clerk's token
      // is not yet available on the very first call after login().
      const delays = [1000, 2500];
      for (const delay of delays) {
        await new Promise((r) => setTimeout(r, delay));
        if (await attempt()) return;
      }
      // Silently fail after all retries — user stays on empty default state.
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  // NOTE: Do NOT trigger refreshData() from the isLoggedIn useEffect.
  // The AsyncStorage restore of isLoggedIn happens before setApiAuthToken() is called
  // from _layout.tsx, so any API call made here would have no Bearer token and would
  // fall back to the demo user. Data loading is triggered explicitly inside login().

  const login = useCallback((name: string, email: string, userId?: string) => {
    setIsLoggedIn(true);
    AsyncStorage.setItem("isLoggedIn", "true");
    setIsLoading(true);
    clerkUserIdRef.current = userId ?? null;
    setIsOnboardingReady(false);
    // hasSeenOnboarding is scoped per Clerk user id so switching accounts on
    // the same device never inherits another account's onboarding state.
    //
    // Returning-user fast path: if AsyncStorage already confirms this userId
    // has seen onboarding, unblock the layout immediately so the app doesn't
    // stall on a network round-trip every time the user opens it.
    //
    // New-user slow path: AsyncStorage has nothing, so we DON'T set
    // isOnboardingReady yet. We wait until refreshData() completes and the
    // server's authoritative onboardingCompleted field is known. This prevents
    // the race where the layout redirects to /onboarding for an existing user
    // who reinstalled the app and lost their local AsyncStorage cache.
    if (userId) {
      AsyncStorage.getItem(`hasSeenOnboarding:${userId}`).then((seen) => {
        if (seen === "true") {
          // Confirmed returning user — unblock immediately.
          setHasSeenOnboarding(true);
          setIsOnboardingReady(true);
        }
        // else: new user or missing cache — isOnboardingReady stays false
        // until load.finally() below, by which point refreshData() has set
        // hasSeenOnboarding from the server if onboardingCompleted is true.
      });
    } else {
      setHasSeenOnboarding(false);
      setIsOnboardingReady(true);
    }
    // Proactively refresh account tokens once per app session so scans never
    // start with stale X / Facebook / Instagram tokens.
    if (!hasRefreshedTokensRef.current) {
      hasRefreshedTokensRef.current = true;
      refreshAccountTokens().catch(() => {
        // Non-fatal — best-effort proactive refresh; scheduler handles missed refreshes.
      });
    }

    // If the caller passes a real name/email (from Clerk's useUser()), patch the
    // DB record so the user sees their actual name instead of "Shield User".
    const load = (name || email)
      ? updateMe({ name: name || undefined, email: email || undefined })
          .then(() => refreshData())
          .catch(() => refreshData())
      : refreshData();
    // Always unblock the layout after the network call completes.
    // For returning users this is a no-op (already true). For new users whose
    // AsyncStorage was empty, this is the first time isOnboardingReady becomes
    // true — by now refreshData() has already written hasSeenOnboarding if the
    // server said onboardingCompleted = true, so no onboarding redirect fires.
    load.finally(() => {
      setIsOnboardingReady(true);
      setIsLoading(false);
    });
  }, [refreshData]);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setUser(DEFAULT_USER);
    setThreats([]);
    setIndexedPhotos([]);
    indexedPhotosRef.current = [];
    setLocalPhotoThreats([]);
    localPhotoThreatsRef.current = [];
    setHasSeenOnboarding(false);
    setIsOnboardingReady(false);
    clerkUserIdRef.current = null;
    // Reset so the next user who logs in also gets a proactive token refresh.
    hasRefreshedTokensRef.current = false;
    AsyncStorage.setItem("isLoggedIn", "false");
    AsyncStorage.removeItem("indexedPhotos");
    AsyncStorage.removeItem("localPhotoThreats");
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
    const newPhotos: IndexedPhoto[] = photos.map(({ uri, base64 }) => ({
      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      localUri: uri,
      base64,
      addedAt: new Date().toISOString(),
      source,
      accountId,
    }));
    setIndexedPhotos((prev) => {
      const next = [...prev, ...newPhotos];
      AsyncStorage.setItem("indexedPhotos", JSON.stringify(next));
      indexedPhotosRef.current = next;
      return next;
    });
  }, []);

  const removeIndexedPhoto = useCallback((id: string) => {
    setIndexedPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      AsyncStorage.setItem("indexedPhotos", JSON.stringify(next));
      indexedPhotosRef.current = next;
      return next;
    });
    setLocalPhotoThreats((prev) => {
      const next = prev.filter((t) => !t.id.includes(id));
      AsyncStorage.setItem("localPhotoThreats", JSON.stringify(next));
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
      if (!state.canScan && state.message) {
        setScanQuotaError({ message: state.message, upgradeTo: state.upgradeTo ?? "premium" });
      } else if (state.canScan) {
        setScanQuotaError(null);
      }
    } catch {
      // Ignore — quota check is best-effort
    }
  }, []);

  const startScan = useCallback(async () => {
    if (isScanning) return;
    setScanQuotaError(null);
    setIsScanning(true);
    setScanProgress(0);
    setScanCurrentStep(null);

    // Safety: never leave isScanning stuck true for more than 3 minutes
    const safetyTimer = setTimeout(() => {
      setIsScanning(false);
      setScanCurrentStep(null);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }, 3 * 60 * 1000);

    // Snapshot monitored photos at scan start so the list can't change mid-scan
    const photosSnapshot = [...indexedPhotosRef.current];

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
      const job = await apiStartScan({ bypassCache: true });

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      const handlePollResult = async () => {
        try {
          const status = await getScanStatus(job.id);
          setScanProgress(status.progress);
          if (status.currentStep) {
            setScanCurrentStep(status.currentStep);
          }

          if (status.status === "completed" || status.status === "failed") {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            clearTimeout(safetyTimer);

            // Wait for any in-flight photo scans before the final data refresh
            await photoScanPromise.catch(() => {});

            setIsScanning(false);
            setScanProgress(100);
            setScanCurrentStep(null);
            const freshThreats = await loadThreats();
            const profile = await getMe();
            const accounts = await getAccounts();
            setUser(mapProfileToUser(profile, accounts));

            const allActive = [
              ...freshThreats.filter((t) => !t.resolved),
              ...localPhotoThreatsRef.current.filter((t) => !t.resolved),
            ];
            const activeCount = allActive.length;
            scheduleScanCompleteNotification(activeCount).catch(() => {});
            const highSeverity = allActive.filter((t) => t.severity === "high");
            if (highSeverity.length > 0 && highSeverity[0]) {
              scheduleThreatNotification(highSeverity[0].title, highSeverity[0].id).catch(() => {});
            }
          }
        } catch {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          clearTimeout(safetyTimer);
          setIsScanning(false);
          setScanCurrentStep(null);
        }
      };

      // Immediate first poll so progress appears without waiting a full interval
      handlePollResult();
      pollTimerRef.current = setInterval(handlePollResult, 400);
    } catch (err) {
      clearTimeout(safetyTimer);
      setIsScanning(false);
      setScanCurrentStep(null);
      if (err instanceof ScanQuotaError) {
        setScanQuotaError({ message: err.userMessage, upgradeTo: err.upgradeTo });
      }
    }
  }, [isScanning, loadThreats]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const resolveThreat = useCallback(async (id: string, action?: string): Promise<void> => {
    // Local photo threats are resolved in client state only
    if (id.startsWith("local_photo_")) {
      setLocalPhotoThreats((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, resolved: true } : t));
        AsyncStorage.setItem("localPhotoThreats", JSON.stringify(next));
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
        isLoggedIn,
        hasSeenOnboarding,
        isInitializing,
        isOnboardingReady,
        isScanning,
        scanProgress,
        scanCurrentStep,
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
        resolveThreat,
        refreshData,
        addAccount,
        removeAccount,
        updateAccount,
        addIndexedPhotos,
        removeIndexedPhoto,
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
