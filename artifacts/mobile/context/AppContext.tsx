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
  type UserProfile,
  type AccountProfile,
  type ThreatSummary,
} from "@/lib/api";

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
  isLoggedIn: boolean;
  hasSeenOnboarding: boolean;
  /** true while AsyncStorage is being read on first mount — gates all route redirects */
  isInitializing: boolean;
  isScanning: boolean;
  scanProgress: number;
  scanCurrentStep: string | null;
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

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("isLoggedIn"),
      AsyncStorage.getItem("hasSeenOnboarding"),
    ]).then(([loggedIn, seenOnboarding]) => {
      if (loggedIn !== null) setIsLoggedIn(loggedIn === "true");
      if (seenOnboarding !== null) setHasSeenOnboarding(seenOnboarding === "true");
      setIsInitializing(false);
    });
  }, []);

  const loadThreats = useCallback(async () => {
    const summaries = await listThreats();
    setThreats(summaries.map(mapSummaryToThreat));
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [profile, accounts, summaries] = await Promise.all([
        getMe(),
        getAccounts(),
        listThreats(),
      ]);
      setUser(mapProfileToUser(profile, accounts));
      setThreats(summaries.map(mapSummaryToThreat));
    } catch {
    }
  }, []);

  // NOTE: Do NOT trigger refreshData() from the isLoggedIn useEffect.
  // The AsyncStorage restore of isLoggedIn happens before setApiAuthToken() is called
  // from _layout.tsx, so any API call made here would have no Bearer token and would
  // fall back to the demo user. Data loading is triggered explicitly inside login().

  const login = useCallback((_name: string, _email: string) => {
    setIsLoggedIn(true);
    AsyncStorage.setItem("isLoggedIn", "true");
    // setApiAuthToken() has been called by _layout.tsx before login() is invoked,
    // so the token getter is ready and refreshData() will include the Bearer header.
    setIsLoading(true);
    refreshData().finally(() => setIsLoading(false));
  }, [refreshData]);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setUser(DEFAULT_USER);
    setThreats([]);
    AsyncStorage.setItem("isLoggedIn", "false");
  }, []);

  const completeOnboarding = useCallback(() => {
    setHasSeenOnboarding(true);
    AsyncStorage.setItem("hasSeenOnboarding", "true");
  }, []);

  const startScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(0);

    try {
      const job = await apiStartScan();

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      pollTimerRef.current = setInterval(async () => {
        try {
          const status = await getScanStatus(job.id);
          setScanProgress(status.progress);
          if (status.currentStep) setScanCurrentStep(status.currentStep);

          if (status.status === "completed" || status.status === "failed") {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            setIsScanning(false);
            setScanProgress(100);
            setScanCurrentStep(null);
            await loadThreats();
            const profile = await getMe();
            const accounts = await getAccounts();
            setUser(mapProfileToUser(profile, accounts));
          }
        } catch {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          setIsScanning(false);
          setScanCurrentStep(null);
        }
      }, 1200);
    } catch {
      setIsScanning(false);
    }
  }, [isScanning, loadThreats]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const resolveThreat = useCallback(async (id: string) => {
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

  const activeThreats = threats.filter(
    (t) => !t.resolved && t.severity === "high"
  ).length;
  const fakeAccounts = threats.filter(
    (t) =>
      !t.resolved &&
      (t.type === "fake_account" ||
        t.type === "impersonator" ||
        t.type === "stolen_photo")
  ).length;
  const leakedPasswords = threats.filter(
    (t) => !t.resolved && t.type === "leaked_password"
  ).length;

  return (
    <AppContext.Provider
      value={{
        user,
        threats,
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
        resolveThreat,
        refreshData,
        addAccount,
        removeAccount,
        updateAccount,
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
