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
  platform: Platform;
  username: string;
  followers: number;
  verified: boolean;
  photosIndexed: number;
  captionsIndexed: number;
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
  totalPhotosIndexed: number;
  totalCaptionsIndexed: number;
  reelsIndexed: number;
  fingerprintUpdated: string;
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
    threatScore: 94,
    suspiciousUsername: "@alexjohnson.official",
    matchedMediaCount: 8,
    aiExplanation:
      "This account was flagged because it reused 8 of your public Instagram photos and 3 captions from your connected account. The profile photo matches yours with 94% similarity. The username follows the most common impersonation pattern — adding 'official' to your handle — and the bio was copied verbatim from your verified profile.",
    evidence: [
      {
        id: "e1",
        type: "profile_photo",
        similarity: 94,
        label: "Profile Photo Match",
      },
      {
        id: "e2",
        type: "post_photo",
        similarity: 88,
        label: "Post Photo Reuse",
        yourCaption: "Feel the vibe ✨ #creator",
        stolenCaption: "Feel the vibe ✨ #creator",
      },
      {
        id: "e3",
        type: "post_photo",
        similarity: 79,
        label: "Photo Reuse #2",
        yourCaption: "Thank you for 10k followers!",
        stolenCaption: "Thank you for the support everyone!",
      },
    ],
    scoreBreakdown: {
      mediaSimilarity: 38,
      contentReuse: 18,
      profileSimilarity: 15,
      bioSimilarity: 9,
      usernameSimilarity: 10,
      behavioral: 4,
    },
    detectedSignals: [
      "8 public photos reused",
      "3 captions duplicated",
      "Username pattern: added 'official'",
      "Bio copied verbatim",
      "Fake giveaway language detected",
      "Rapid follower acquisition pattern",
    ],
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
    threatScore: 61,
    suspiciousUsername: "DataCore Breach",
    matchedMediaCount: 0,
    aiExplanation:
      "Your email was found in the 2024 DataCore breach dataset. While the leaked password was hashed, modern cracking techniques can reverse common passwords. We recommend updating your password immediately and enabling two-factor authentication.",
    evidence: [],
    scoreBreakdown: {
      mediaSimilarity: 0,
      contentReuse: 0,
      profileSimilarity: 0,
      bioSimilarity: 0,
      usernameSimilarity: 0,
      behavioral: 61,
    },
    detectedSignals: [
      "Email found in DataCore 2024 breach",
      "45M records compromised",
      "Hashed password exposed",
      "No media reuse detected",
    ],
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
    threatScore: 34,
    suspiciousUsername: "Unknown Actor",
    matchedMediaCount: 0,
    aiExplanation:
      "This login attempt originates from Russia — a region with zero prior access history on your account. The IP address is associated with residential proxy services often used by credential stuffing bots. The attempt was blocked.",
    evidence: [],
    scoreBreakdown: {
      mediaSimilarity: 0,
      contentReuse: 0,
      profileSimilarity: 0,
      bioSimilarity: 0,
      usernameSimilarity: 0,
      behavioral: 34,
    },
    detectedSignals: [
      "Unusual geographic location",
      "Known proxy IP range",
      "First-time location",
      "Single failed attempt",
    ],
  },
  {
    id: "4",
    type: "stolen_photo",
    severity: "high",
    platform: "tiktok",
    title: "Stolen Photos Detected",
    description: "Account using 12 of your photos without permission on TikTok",
    details:
      "A TikTok account was found using 12 of your uploaded photos and reel thumbnails. The account has 4,100 followers and has been active for 2 weeks, operating as a fake brand page.",
    time: "5h ago",
    resolved: false,
    threatScore: 88,
    suspiciousUsername: "@alexj.creator",
    matchedMediaCount: 12,
    aiExplanation:
      "Our photo monitoring system found 12 of your public photos reposted on this TikTok account. The stolen content includes reel thumbnails, post photos, and even older uploads from over 6 months ago — suggesting deliberate catalog scraping. This account was created recently and shows rapid engagement manipulation.",
    evidence: [
      {
        id: "e4",
        type: "reel_thumbnail",
        similarity: 91,
        label: "Reel Thumbnail Reuse",
      },
      {
        id: "e5",
        type: "post_photo",
        similarity: 83,
        label: "Post Photo Reuse #1",
        yourCaption: "Behind the scenes today 🎬",
        stolenCaption: "Content creator life",
      },
      {
        id: "e6",
        type: "post_photo",
        similarity: 76,
        label: "Post Photo Reuse #2",
      },
    ],
    scoreBreakdown: {
      mediaSimilarity: 36,
      contentReuse: 20,
      profileSimilarity: 12,
      bioSimilarity: 8,
      usernameSimilarity: 7,
      behavioral: 5,
    },
    detectedSignals: [
      "12 photos stolen from your account",
      "Reel thumbnails copied",
      "Older archive photos reused",
      "Rapid follower growth pattern",
      "Engagement manipulation detected",
    ],
  },
  {
    id: "5",
    type: "scam",
    severity: "medium",
    platform: "x",
    title: "Scam Giveaway Detected",
    description: "Fake giveaway using your name and photo on X",
    details:
      "An account on X is running a fake giveaway claiming to be affiliated with you. They are using your profile photo and promising prizes to followers who send cryptocurrency to a wallet address.",
    time: "1d ago",
    resolved: false,
    threatScore: 76,
    suspiciousUsername: "@alex_johnson_real",
    matchedMediaCount: 3,
    aiExplanation:
      "This account is using your profile photo and brand to run a cryptocurrency scam giveaway. The language patterns (urgency, 'limited time', crypto requests) match known social media scam templates. Your followers could be defrauded by this account.",
    evidence: [
      {
        id: "e7",
        type: "profile_photo",
        similarity: 82,
        label: "Profile Photo Match",
        yourCaption: "Content creator & digital artist",
        stolenCaption: "Official account | Giving back to fans",
      },
    ],
    scoreBreakdown: {
      mediaSimilarity: 30,
      contentReuse: 14,
      profileSimilarity: 14,
      bioSimilarity: 6,
      usernameSimilarity: 8,
      behavioral: 4,
    },
    detectedSignals: [
      "Profile photo reused with filter",
      "Scam giveaway language detected",
      "Crypto wallet solicitation",
      "Urgency language pattern",
      "Recent account creation",
    ],
  },
  {
    id: "6",
    type: "fake_account",
    severity: "medium",
    platform: "facebook",
    title: "Fake Facebook Page",
    description: "Unofficial page impersonating your brand on Facebook",
    details:
      "A Facebook page was found using your name and a modified version of your profile image. The page has 890 likes and is posting misleading content to redirect your audience.",
    time: "2d ago",
    resolved: false,
    threatScore: 68,
    suspiciousUsername: "Alex Johnson Official Fan",
    matchedMediaCount: 4,
    aiExplanation:
      "This Facebook page uses modified versions of your profile images and brand assets. The content strategy mimics yours but redirects engagement toward sponsored links. Profile image similarity is 76% — lower than direct copies, suggesting intentional editing to avoid detection.",
    evidence: [
      {
        id: "e8",
        type: "profile_photo",
        similarity: 76,
        label: "Profile Photo (Edited)",
      },
      {
        id: "e9",
        type: "post_photo",
        similarity: 69,
        label: "Post Photo (Cropped)",
      },
    ],
    scoreBreakdown: {
      mediaSimilarity: 26,
      contentReuse: 16,
      profileSimilarity: 12,
      bioSimilarity: 7,
      usernameSimilarity: 5,
      behavioral: 2,
    },
    detectedSignals: [
      "Profile photo cropped & filtered",
      "4 posts reused with modifications",
      "Brand name in page title",
      "Affiliate link promotion",
    ],
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
    threatScore: 22,
    suspiciousUsername: "Dark Web Actor",
    matchedMediaCount: 0,
    aiExplanation:
      "Your username was found on the dark web but the context appears to be a low-risk social media discussion. No personal identifying information, credentials, or physical details were associated with this mention. We recommend monitoring for escalation.",
    evidence: [],
    scoreBreakdown: {
      mediaSimilarity: 0,
      contentReuse: 0,
      profileSimilarity: 0,
      bioSimilarity: 0,
      usernameSimilarity: 12,
      behavioral: 10,
    },
    detectedSignals: [
      "Username mentioned in dark web thread",
      "No PII exposed",
      "Low-risk discussion context",
      "No credential data found",
    ],
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
  totalPhotosIndexed: 247,
  totalCaptionsIndexed: 183,
  reelsIndexed: 41,
  fingerprintUpdated: "2 hours ago",
  connectedAccounts: [
    {
      platform: "instagram",
      username: "@alexjohnson",
      followers: 12400,
      verified: true,
      photosIndexed: 84,
      captionsIndexed: 72,
    },
    {
      platform: "x",
      username: "@alexjohnson",
      followers: 8200,
      verified: true,
      photosIndexed: 31,
      captionsIndexed: 48,
    },
    {
      platform: "tiktok",
      username: "@alexj",
      followers: 24100,
      verified: true,
      photosIndexed: 67,
      captionsIndexed: 31,
    },
    {
      platform: "linkedin",
      username: "alex-johnson",
      followers: 1800,
      verified: true,
      photosIndexed: 12,
      captionsIndexed: 18,
    },
    {
      platform: "youtube",
      username: "AlexJohnson",
      followers: 5600,
      verified: true,
      photosIndexed: 38,
      captionsIndexed: 8,
    },
    {
      platform: "facebook",
      username: "alexjohnson",
      followers: 3200,
      verified: true,
      photosIndexed: 15,
      captionsIndexed: 6,
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

  const login = useCallback((_name: string, _email: string) => {
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
