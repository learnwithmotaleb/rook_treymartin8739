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
  resolveThreat as apiResolveThreat,
  addAccount as apiAddAccount,
  removeAccount as apiRemoveAccount,
  updateAccount as apiUpdateAccount,
  updateMe,
  reverseImageSearch,
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
  label: string;
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
  aiExplanation: string;
  threatScore: number;
  suspiciousUsername: string;
  matchedMediaCount: number;
  evidence: MatchedEvidence[];
  scoreBreakdown: ThreatScoreBreakdown;
  detectedSignals: string[];
}

export interface ConnectedAccount {
  id: string;
  platform: Platform;
  username: string;
  followers: number;
  verified: boolean;
  photosIndexed: number;
  captionsIndexed: number;
  lastSynced: string | null;
}

export interface User {
  name: string;
  email: string;
  username: string;
  avatarInitials: string;
  securityScore: number;
  scoreTrend: number;
  isPremium: boolean;
  tier: "free" | "pro" | "premium";
  connectedAccounts: ConnectedAccount[];
  monitored: number;
  lastScan: string;
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
  securityScore: 0,
  scoreTrend: 0,
  isPremium: false,
  tier: "free",
  connectedAccounts: [],
  monitored: 0,
  lastScan: "Never",
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
  isScanning: boolean;
  scanProgress: number;
  scanCurrentStep: string | null;
  scanQuotaError: { message: string; upgradeTo: string } | null;
  isLoading: boolean;
  activeThreats: number;
  fakeAccounts: number;
  leakedPasswords: number;
  login: (name: string, email: string) => void;
  logout: () => void;
  completeOnboarding: () => void;
  startScan: () => void;
  resolveThreat: (id: string) => void;
  refreshData: () => Promise<void>;
  addAccount: (platform: string, username: string, accessToken?: string) => Promise<ConnectedAccount>;
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
    aiExplanation: "",
    threatScore: t.threatScore,
    suspiciousUsername: t.suspiciousUsername ?? "",
    matchedMediaCount: t.matchedMediaCount,
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
    securityScore: profile.securityScore,
    scoreTrend: profile.scoreTrend,
    isPremium: profile.isPremium,
    tier: (profile.tier as "free" | "pro" | "premium") ?? "free",
    monitored: profile.monitored,
    lastScan: profile.lastScan,
    totalPhotosIndexed: profile.totalPhotosIndexed,
    totalCaptionsIndexed: profile.totalCaptionsIndexed,
    reelsIndexed: profile.reelsIndexed,
    fingerprintUpdated: profile.fingerprintUpdated,
    connectedAccounts: accounts.map(mapAccountToConnected),
  };
}

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
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanCurrentStep, setScanCurrentStep] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [indexedPhotos, setIndexedPhotos] = useState<IndexedPhoto[]>([]);
  const indexedPhotosRef = useRef<IndexedPhoto[]>([]);
  const [localPhotoThreats, setLocalPhotoThreats] = useState<Threat[]>([]);
  const localPhotoThreatsRef = useRef<Threat[]>([]);

  useEffect(() => { indexedPhotosRef.current = indexedPhotos; }, [indexedPhotos]);
  useEffect(() => { localPhotoThreatsRef.current = localPhotoThreats; }, [localPhotoThreats]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("isLoggedIn"),
      AsyncStorage.getItem("hasSeenOnboarding"),
      AsyncStorage.getItem("indexedPhotos"),
      AsyncStorage.getItem("localPhotoThreats"),
    ]).then(([loggedIn, seenOnboarding, storedPhotos, storedLocalThreats]) => {
      if (loggedIn !== null) setIsLoggedIn(loggedIn === "true");
      if (seenOnboarding !== null) setHasSeenOnboarding(seenOnboarding === "true");
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
    const attempt = async (): Promise<boolean> => {
      try {
        const [profile, accounts, summaries] = await Promise.all([
          getMe(),
          getAccounts(),
          listThreats(),
        ]);
        setUser(mapProfileToUser(profile, accounts));
        setThreats(summaries.map(mapSummaryToThreat));
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
  }, []);

  // NOTE: Do NOT trigger refreshData() from the isLoggedIn useEffect.
  // The AsyncStorage restore of isLoggedIn happens before setApiAuthToken() is called
  // from _layout.tsx, so any API call made here would have no Bearer token and would
  // fall back to the demo user. Data loading is triggered explicitly inside login().

  const login = useCallback((name: string, email: string) => {
    setIsLoggedIn(true);
    AsyncStorage.setItem("isLoggedIn", "true");
    setIsLoading(true);
    // If the caller passes a real name/email (from Clerk's useUser()), patch the
    // DB record so the user sees their actual name instead of "Shield User".
    const load = (name || email)
      ? updateMe({ name: name || undefined, email: email || undefined })
          .then(() => refreshData())
          .catch(() => refreshData())
      : refreshData();
    load
      .then(() => {
        // Auto-complete onboarding for returning users — if they already have
        // a profile name or connected accounts the onboarding has been done.
        setHasSeenOnboarding((prev) => {
          if (!prev) {
            AsyncStorage.setItem("hasSeenOnboarding", "true");
            return true;
          }
          return prev;
        });
      })
      .finally(() => setIsLoading(false));
  }, [refreshData]);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setUser(DEFAULT_USER);
    setThreats([]);
    setIndexedPhotos([]);
    indexedPhotosRef.current = [];
    setLocalPhotoThreats([]);
    localPhotoThreatsRef.current = [];
    AsyncStorage.setItem("isLoggedIn", "false");
    AsyncStorage.removeItem("indexedPhotos");
    AsyncStorage.removeItem("localPhotoThreats");
  }, []);

  const completeOnboarding = useCallback(() => {
    setHasSeenOnboarding(true);
    AsyncStorage.setItem("hasSeenOnboarding", "true");
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
      const job = await apiStartScan();

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      pollTimerRef.current = setInterval(async () => {
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
      }, 1200);
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

  const resolveThreat = useCallback(async (id: string) => {
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
      await apiResolveThreat(id);
    } catch {
      setThreats((prev) =>
        prev.map((t) => (t.id === id ? { ...t, resolved: false } : t))
      );
    }
  }, []);

  const addAccount = useCallback(async (platform: string, username: string, accessToken?: string): Promise<ConnectedAccount> => {
    const account = await apiAddAccount(platform, username, accessToken);
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
    (t) => !t.resolved && t.severity === "high"
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

  return (
    <AppContext.Provider
      value={{
        user,
        threats: mergedThreats,
        indexedPhotos,
        isLoggedIn,
        hasSeenOnboarding,
        isInitializing,
        isScanning,
        scanProgress,
        scanCurrentStep,
        isLoading,
        activeThreats,
        fakeAccounts,
        leakedPasswords,
        login,
        logout,
        completeOnboarding,
        startScan,
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
