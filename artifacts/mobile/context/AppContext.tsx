import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Severity = "high" | "medium" | "low";
export type ThreatType =
  | "impersonator"
  | "fake_account"
  | "leaked_password"
  | "suspicious_login"
  | "stolen_photo"
  | "scam"
  | "dark_web";
export type Platform =
  | "instagram"
  | "x"
  | "tiktok"
  | "linkedin"
  | "youtube"
  | "facebook"
  | "snapchat"
  | null;

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
}

export interface ConnectedAccount {
  platform: Platform;
  username: string;
  followers: number;
  verified: boolean;
}

export interface User {
  name: string;
  email: string;
  username: string;
  avatarInitials: string;
  securityScore: number;
  scoreTrend: number;
  isPremium: boolean;
  connectedAccounts: ConnectedAccount[];
  monitored: number;
  lastScan: string;
}

interface AppContextType {
  user: User;
  threats: Threat[];
  isLoggedIn: boolean;
  hasSeenOnboarding: boolean;
  isScanning: boolean;
  scanProgress: number;
  activeThreats: number;
  fakeAccounts: number;
  leakedPasswords: number;
  login: (name: string, email: string) => void;
  logout: () => void;
  completeOnboarding: () => void;
  startScan: () => void;
  resolveThreat: (id: string) => void;
}

const MOCK_THREATS: Threat[] = [
  {
    id: "1",
    type: "impersonator",
    severity: "high",
    platform: "instagram",
    title: "Impersonator Detected",
    description: "@your.username.official is impersonating you on Instagram",
    details:
      "An account was found using your exact profile photo and a similar username with slight variations. They have 2,300 followers and are posting content pretending to be you, including fake DM requests and giveaways.",
    time: "2m ago",
    resolved: false,
    aiExplanation:
      "This account was flagged because its profile photo closely matches yours with a 94% similarity score. The bio contains copied keywords and the username follows a common impersonation pattern by adding 'official' to your handle.",
  },
  {
    id: "2",
    type: "leaked_password",
    severity: "medium",
    platform: null,
    title: "Leaked Password Found",
    description: "Your email was found in a recent data breach",
    details:
      "Your email address was discovered in the 2024 DataCore breach, which exposed 45 million records. Your hashed password and email were included in the leaked dataset.",
    time: "1h ago",
    resolved: false,
    aiExplanation:
      "Your credentials were found in a breach database. We recommend changing your password immediately and enabling two-factor authentication on all accounts using this email.",
  },
  {
    id: "3",
    type: "suspicious_login",
    severity: "low",
    platform: null,
    title: "Suspicious Login Attempt",
    description: "Login attempt detected from Moscow, Russia",
    details:
      "An unusual login attempt was detected from an IP address in Moscow, Russia — a location you have never accessed your account from. The attempt failed after password verification.",
    time: "3h ago",
    resolved: false,
    aiExplanation:
      "This login attempt originates from a region with no prior access history in your account. The attempt was blocked, but it suggests someone may have your email and is attempting a credential attack.",
  },
  {
    id: "4",
    type: "stolen_photo",
    severity: "high",
    platform: "tiktok",
    title: "Stolen Photo Detected",
    description: "Account with stolen profile photo found on TikTok",
    details:
      "A TikTok account was found using one of your profile photos with an 89% image similarity match. The account has 4,100 followers and has been active for 2 weeks.",
    time: "5h ago",
    resolved: false,
    aiExplanation:
      "Our photo monitoring system detected a near-identical match to your profile photo. The suspected account was created recently and shows a rapid follower growth pattern typical of impersonator accounts.",
  },
  {
    id: "5",
    type: "scam",
    severity: "medium",
    platform: "x",
    title: "Scam Giveaway Detected",
    description: "Fake giveaway using your name found on X",
    details:
      "An account on X is running a fake giveaway claiming to be affiliated with you. They are promising prizes to followers who send cryptocurrency to a wallet address.",
    time: "1d ago",
    resolved: false,
    aiExplanation:
      "This account uses your name in a giveaway post designed to defraud your followers. The language patterns and request for cryptocurrency payments are consistent with known social media scam tactics.",
  },
  {
    id: "6",
    type: "fake_account",
    severity: "medium",
    platform: "facebook",
    title: "Fake Facebook Page",
    description: "Unofficial page impersonating your brand on Facebook",
    details:
      "A Facebook page was found using your name and a modified version of your profile image. The page has 890 likes and is posting misleading content.",
    time: "2d ago",
    resolved: false,
    aiExplanation:
      "This page exhibits classic brand impersonation patterns: unauthorized use of your image, similar name with minor spelling changes, and content designed to redirect your audience.",
  },
  {
    id: "7",
    type: "dark_web",
    severity: "low",
    platform: null,
    title: "Dark Web Mention",
    description: "Your username was mentioned in a dark web forum",
    details:
      "Your username appeared in a dark web discussion thread. The mention appears to be referencing your social presence rather than any personal information.",
    time: "3d ago",
    resolved: false,
    aiExplanation:
      "While your username was found on the dark web, the context suggests this is a low-risk reference. No personal identifying information or credentials were found alongside this mention.",
  },
];

const MOCK_USER: User = {
  name: "Alex Johnson",
  email: "alex@example.com",
  username: "@alexjohnson",
  avatarInitials: "AJ",
  securityScore: 72,
  scoreTrend: 12,
  isPremium: false,
  monitored: 6,
  lastScan: "Today, 9:42 AM",
  connectedAccounts: [
    {
      platform: "instagram",
      username: "@alexjohnson",
      followers: 12400,
      verified: false,
    },
    {
      platform: "x",
      username: "@alexjohnson",
      followers: 8200,
      verified: false,
    },
    {
      platform: "tiktok",
      username: "@alexj",
      followers: 24100,
      verified: false,
    },
    {
      platform: "linkedin",
      username: "alex-johnson",
      followers: 1800,
      verified: false,
    },
    {
      platform: "youtube",
      username: "AlexJohnson",
      followers: 5600,
      verified: false,
    },
    {
      platform: "facebook",
      username: "alexjohnson",
      followers: 3200,
      verified: false,
    },
  ],
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user] = useState<User>(MOCK_USER);
  const [threats, setThreats] = useState<Threat[]>(MOCK_THREATS);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem("isLoggedIn").then((val) => {
      if (val !== null) setIsLoggedIn(val === "true");
    });
    AsyncStorage.getItem("hasSeenOnboarding").then((val) => {
      if (val !== null) setHasSeenOnboarding(val === "true");
    });
  }, []);

  const login = useCallback((name: string, email: string) => {
    setIsLoggedIn(true);
    AsyncStorage.setItem("isLoggedIn", "true");
  }, []);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    AsyncStorage.setItem("isLoggedIn", "false");
  }, []);

  const completeOnboarding = useCallback(() => {
    setHasSeenOnboarding(true);
    AsyncStorage.setItem("hasSeenOnboarding", "true");
  }, []);

  const startScan = useCallback(() => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          return 100;
        }
        return prev + 2;
      });
    }, 60);
  }, [isScanning]);

  const resolveThreat = useCallback((id: string) => {
    setThreats((prev) =>
      prev.map((t) => (t.id === id ? { ...t, resolved: true } : t))
    );
  }, []);

  const activeThreats = threats.filter(
    (t) => !t.resolved && t.severity === "high"
  ).length;
  const fakeAccounts = threats.filter(
    (t) => !t.resolved && (t.type === "fake_account" || t.type === "impersonator" || t.type === "stolen_photo")
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
        isScanning,
        scanProgress,
        activeThreats,
        fakeAccounts,
        leakedPasswords,
        login,
        logout,
        completeOnboarding,
        startScan,
        resolveThreat,
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
