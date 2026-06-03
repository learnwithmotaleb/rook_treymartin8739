/**
 * Platform Adapter Interface & Registry
 *
 * Each social platform has its own adapter that implements PlatformAdapter.
 *
 * PRODUCTION SETUP — each platform requires an approved developer application:
 *
 * Instagram / Facebook:
 *   - Register at: https://developers.facebook.com/
 *   - Required permissions: instagram_basic, pages_show_list, instagram_manage_insights
 *   - OAuth 2.0 flow with user authorization
 *   - Set: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET
 *
 * X (Twitter):
 *   - Register at: https://developer.twitter.com/
 *   - Required: Twitter API v2 access (Basic tier minimum)
 *   - OAuth 2.0 PKCE flow
 *   - Set: TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET
 *
 * TikTok:
 *   - Register at: https://developers.tiktok.com/
 *   - Required: Content Posting API + Research API access
 *   - OAuth 2.0 flow
 *   - Set: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
 *
 * LinkedIn:
 *   - Register at: https://www.linkedin.com/developers/
 *   - Required: r_basicprofile, r_emailaddress permissions
 *   - OAuth 2.0 flow
 *   - Set: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
 *
 * TOS COMPLIANCE NOTE:
 * All data ingestion MUST use official platform APIs only.
 * Scraping, crawling, or unauthorized data access violates platform TOS
 * and may result in legal liability. ShieldID only accesses data that
 * users explicitly authorize via OAuth.
 */

export interface MediaItem {
  platformMediaId: string;
  type: "image" | "video" | "carousel";
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  postedAt?: Date;
}

export interface ProfileData {
  platformUserId: string;
  username: string;
  displayName?: string;
  followers: number;
  profileImageUrl?: string;
  bio?: string;
}

export interface CandidateAccount {
  platformUserId: string;
  username: string;
  platform: string;
  profileImageUrl?: string;
  followers: number;
  similarity: number;
}

export interface PlatformAdapter {
  platform: string;
  getProfile(accessToken: string): Promise<ProfileData>;
  getMediaItems(
    accessToken: string,
    platformUserId: string,
    limit?: number
  ): Promise<MediaItem[]>;
  searchByUsername(username: string, accessToken?: string): Promise<CandidateAccount[]>;
  isConfigured(): boolean;
}

export class InstagramAdapter implements PlatformAdapter {
  platform = "instagram";

  isConfigured(): boolean {
    return !!(
      (process.env["INSTAGRAM_CLIENT_ID"] ?? process.env["INSTAGRAM_APP_ID"]) &&
      (process.env["INSTAGRAM_CLIENT_SECRET"] ?? process.env["INSTAGRAM_APP_SECRET"])
    );
  }

  async getProfile(accessToken: string): Promise<ProfileData> {
    // instagram_business_basic scope (replaces deprecated instagram_basic since Jan 2025)
    // provides: id, username, name, account_type, media_count,
    //           profile_picture_url, followers_count, biography
    const response = await fetch(
      `https://graph.instagram.com/me?fields=id,username,name,account_type,media_count,profile_picture_url,followers_count,biography&access_token=${accessToken}`
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Instagram API error: ${response.status} — ${text}`);
    }
    const data = await response.json() as {
      id: string;
      username: string;
      name?: string;
      account_type?: string;
      media_count?: number;
      profile_picture_url?: string;
      followers_count?: number;
      biography?: string;
    };
    return {
      platformUserId: data.id,
      username: data.username,
      displayName: data.name,
      followers: data.followers_count ?? 0,
      profileImageUrl: data.profile_picture_url,
      bio: data.biography ?? (data.account_type ? `${data.account_type} account` : undefined),
    };
  }

  async getMediaItems(
    accessToken: string,
    platformUserId: string,
    limit = 50
  ): Promise<MediaItem[]> {
    const response = await fetch(
      `https://graph.instagram.com/${platformUserId}/media?fields=id,media_type,media_url,thumbnail_url,caption,timestamp&limit=${limit}&access_token=${accessToken}`
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Instagram media API error: ${response.status} — ${text}`);
    }
    const data = await response.json() as { data?: Array<{
      id: string;
      media_type: string;
      media_url?: string;
      thumbnail_url?: string;
      caption?: string;
      timestamp?: string;
    }> };
    return (data.data ?? []).map((item) => ({
      platformMediaId: item.id,
      type: (item.media_type === "VIDEO" ? "video" : item.media_type === "CAROUSEL_ALBUM" ? "carousel" : "image") as MediaItem["type"],
      url: item.media_url ?? "",
      thumbnailUrl: item.thumbnail_url,
      caption: item.caption,
      postedAt: item.timestamp ? new Date(item.timestamp) : undefined,
    }));
  }

  async searchByUsername(username: string): Promise<CandidateAccount[]> {
    // Instagram's Graph API does not expose public username search for third parties.
    // Impersonator discovery relies on media similarity and the user reporting
    // suspicious accounts. This is by design per Instagram's platform policies.
    return [];
  }
}

export class TwitterAdapter implements PlatformAdapter {
  platform = "x";

  isConfigured(): boolean {
    return !!(
      process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET
    );
  }

  async getProfile(accessToken: string): Promise<ProfileData> {
    if (!this.isConfigured()) {
      throw new Error("Twitter adapter not configured. Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET.");
    }
    const response = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url,description",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) throw new Error(`Twitter API error: ${response.status}`);
    const { data } = await response.json() as { data: {
      id: string;
      name: string;
      username: string;
      public_metrics?: { followers_count?: number };
      profile_image_url?: string;
      description?: string;
    }};
    return {
      platformUserId: data.id,
      username: data.username,
      displayName: data.name,
      followers: data.public_metrics?.followers_count ?? 0,
      profileImageUrl: data.profile_image_url,
      bio: data.description,
    };
  }

  async getMediaItems(
    accessToken: string,
    platformUserId: string,
    limit = 50
  ): Promise<MediaItem[]> {
    if (!this.isConfigured()) {
      throw new Error("Twitter adapter not configured.");
    }
    const response = await fetch(
      `https://api.twitter.com/2/users/${platformUserId}/tweets?expansions=attachments.media_keys&media.fields=url,preview_image_url,type&max_results=${Math.min(limit, 100)}&tweet.fields=text,created_at`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) throw new Error(`Twitter API error: ${response.status}`);
    const data = await response.json() as {
      data?: Array<{ id: string; text?: string; created_at?: string }>;
      includes?: { media?: Array<{ media_key: string; type: string; url?: string; preview_image_url?: string }> };
    };
    const media = data.includes?.media ?? [];
    return media.map((m) => ({
      platformMediaId: m.media_key,
      type: (m.type === "video" ? "video" : "image") as MediaItem["type"],
      url: m.url ?? m.preview_image_url ?? "",
      thumbnailUrl: m.preview_image_url,
    }));
  }

  async searchByUsername(
    username: string,
    accessToken?: string
  ): Promise<CandidateAccount[]> {
    if (!accessToken || !this.isConfigured()) return [];
    const response = await fetch(
      `https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics,profile_image_url`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) return [];
    const { data } = await response.json() as { data?: {
      id: string;
      username: string;
      name?: string;
      public_metrics?: { followers_count?: number };
      profile_image_url?: string;
    }};
    if (!data) return [];
    return [
      {
        platformUserId: data.id,
        username: data.username,
        platform: "x",
        profileImageUrl: data.profile_image_url,
        followers: data.public_metrics?.followers_count ?? 0,
        similarity: 0,
      },
    ];
  }
}

export class TikTokAdapter implements PlatformAdapter {
  platform = "tiktok";

  isConfigured(): boolean {
    return !!(
      process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET
    );
  }

  async getProfile(accessToken: string): Promise<ProfileData> {
    if (!this.isConfigured()) {
      throw new Error("TikTok adapter not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.");
    }
    const response = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username,follower_count,bio_description",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) throw new Error(`TikTok API error: ${response.status}`);
    const { data } = await response.json() as { data?: { user?: {
      open_id: string;
      username?: string;
      display_name?: string;
      follower_count?: number;
      avatar_url?: string;
      bio_description?: string;
    }}};
    const user = data?.user;
    if (!user) throw new Error("TikTok user data missing");
    return {
      platformUserId: user.open_id,
      username: user.username ?? user.display_name ?? "",
      displayName: user.display_name,
      followers: user.follower_count ?? 0,
      profileImageUrl: user.avatar_url,
      bio: user.bio_description,
    };
  }

  async getMediaItems(
    accessToken: string,
    _platformUserId: string,
    limit = 50
  ): Promise<MediaItem[]> {
    if (!this.isConfigured()) {
      throw new Error("TikTok adapter not configured.");
    }
    const response = await fetch(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,cover_image_url,share_url,title,create_time",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ max_count: Math.min(limit, 20) }),
      }
    );
    if (!response.ok) throw new Error(`TikTok API error: ${response.status}`);
    const { data } = await response.json() as { data?: { videos?: Array<{
      id: string;
      cover_image_url?: string;
      share_url?: string;
      title?: string;
      create_time?: number;
    }> }};
    return (data?.videos ?? []).map((v) => ({
      platformMediaId: v.id,
      type: "video" as const,
      url: v.share_url ?? "",
      thumbnailUrl: v.cover_image_url,
      caption: v.title,
      postedAt: v.create_time ? new Date(v.create_time * 1000) : undefined,
    }));
  }

  async searchByUsername(): Promise<CandidateAccount[]> {
    // TikTok Research API does not expose public user search by username
    // in the standard developer tier. Enterprise Research API required.
    return [];
  }
}

export class FacebookAdapter implements PlatformAdapter {
  platform = "facebook";

  isConfigured(): boolean {
    return !!(
      (process.env["FACEBOOK_APP_ID"] ?? process.env["INSTAGRAM_CLIENT_ID"]) &&
      (process.env["FACEBOOK_APP_SECRET"] ?? process.env["INSTAGRAM_CLIENT_SECRET"])
    );
  }

  async getProfile(accessToken: string): Promise<ProfileData> {
    const response = await fetch(
      `https://graph.facebook.com/me?fields=id,name,picture.type(large)&access_token=${accessToken}`
    );
    if (!response.ok) throw new Error(`Facebook API error: ${response.status}`);
    const data = (await response.json()) as {
      id: string;
      name?: string;
      picture?: { data?: { url?: string } };
    };
    return {
      platformUserId: data.id,
      username: data.name ?? data.id,
      displayName: data.name,
      followers: 0,
      profileImageUrl: data.picture?.data?.url,
    };
  }

  async getMediaItems(
    accessToken: string,
    _platformUserId: string,
    limit = 50
  ): Promise<MediaItem[]> {
    // user_photos permission requires App Review — gracefully return empty if not granted
    const response = await fetch(
      `https://graph.facebook.com/me/photos?type=uploaded&fields=id,picture,name,created_time&limit=${limit}&access_token=${accessToken}`
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      data?: Array<{
        id: string;
        picture?: string;
        name?: string;
        created_time?: string;
      }>;
      error?: { code: number; message: string };
    };
    // Permission denied (code 200) — not an error, just not granted yet
    if (data.error) return [];
    return (data.data ?? []).map((item) => ({
      platformMediaId: item.id,
      type: "image" as const,
      url: item.picture ?? "",
      caption: item.name,
      postedAt: item.created_time ? new Date(item.created_time) : undefined,
    }));
  }

  async searchByUsername(): Promise<CandidateAccount[]> {
    // Facebook Graph API does not expose public profile search for third-party apps.
    // Discovery relies on web search (webSearchService) and media similarity signals.
    return [];
  }
}

const adapters: Record<string, PlatformAdapter> = {
  instagram: new InstagramAdapter(),
  x: new TwitterAdapter(),
  tiktok: new TikTokAdapter(),
  facebook: new FacebookAdapter(),
};

export function getAdapter(platform: string): PlatformAdapter | null {
  return adapters[platform] ?? null;
}
