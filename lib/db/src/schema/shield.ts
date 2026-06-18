import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").unique(),
  email: text("email").unique(),
  name: text("name").notNull(),
  username: text("username").notNull(),
  avatarInitials: text("avatar_initials").notNull().default(""),
  securityScore: integer("security_score").notNull().default(72),
  scoreTrend: integer("score_trend").notNull().default(0),
  nextScanDue: timestamp("next_scan_due", { withTimezone: true }),
  avatarUrl: text("avatar_url"),
  scanCount: integer("scan_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectUserSchema = createSelectSchema(usersTable);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const connectedAccountsTable = pgTable("connected_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  platformUserId: text("platform_user_id"),
  username: text("username").notNull(),
  displayName: text("display_name"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  followers: integer("followers").notNull().default(0),
  verified: boolean("verified").notNull().default(false),
  photosIndexed: integer("photos_indexed").notNull().default(0),
  captionsIndexed: integer("captions_indexed").notNull().default(0),
  reelsIndexed: integer("reels_indexed").notNull().default(0),
  lastSynced: timestamp("last_synced", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertConnectedAccountSchema = createInsertSchema(
  connectedAccountsTable
).omit({ id: true, createdAt: true });
export type InsertConnectedAccount = z.infer<
  typeof insertConnectedAccountSchema
>;
export type ConnectedAccount = typeof connectedAccountsTable.$inferSelect;

export const mediaItemsTable = pgTable("media_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => connectedAccountsTable.id, { onDelete: "cascade" }),
  platformMediaId: text("platform_media_id").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  caption: text("caption"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  embeddingVector: text("embedding_vector"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMediaItemSchema = createInsertSchema(mediaItemsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMediaItem = z.infer<typeof insertMediaItemSchema>;
export type MediaItem = typeof mediaItemsTable.$inferSelect;

export const visualFingerprintsTable = pgTable("visual_fingerprints", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(),
  totalPhotosIndexed: integer("total_photos_indexed").notNull().default(0),
  totalCaptionsIndexed: integer("total_captions_indexed").notNull().default(0),
  reelsIndexed: integer("reels_indexed").notNull().default(0),
  styleEmbeddingJson: text("style_embedding_json"),
  colorPaletteJson: text("color_palette_json"),
  lastUpdated: timestamp("last_updated", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertVisualFingerprintSchema = createInsertSchema(
  visualFingerprintsTable
).omit({ id: true });
export type InsertVisualFingerprint = z.infer<
  typeof insertVisualFingerprintSchema
>;
export type VisualFingerprint = typeof visualFingerprintsTable.$inferSelect;

export const scanJobsTable = pgTable("scan_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  currentStep: text("current_step"),
  threatsFound: integer("threats_found").notNull().default(0),
  metadataJson: text("metadata_json"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertScanJobSchema = createInsertSchema(scanJobsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertScanJob = z.infer<typeof insertScanJobSchema>;
export type ScanJob = typeof scanJobsTable.$inferSelect;

// ─── Threat Intelligence Graph ────────────────────────────────────────────────

/**
 * Canonical bad-actor records deduplicated across all users.
 * When multiple users are targeted by the same suspicious username cluster,
 * they share one threat_actor row — confidence grows with each new victim.
 * Must be defined before threatsTable due to FK reference.
 */
export const threatActorsTable = pgTable("threat_actors", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Representative username (lowercased). */
  canonicalUsername: text("canonical_username"),
  /** JSON array of observed pHash strings from victim comparisons. */
  pHashClusterJson: text("phash_cluster_json").default("[]"),
  /** Number of distinct users targeted by this actor. */
  victimCount: integer("victim_count").notNull().default(1),
  /** JSON array of platform strings where this actor was detected. */
  platformSetJson: text("platform_set_json").default("[]"),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  /**
   * 0–100 score derived from victim count and platform diversity.
   * Formula: min(100, victimCount * 15 + uniquePlatforms * 5)
   */
  confidenceScore: integer("confidence_score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ThreatActor = typeof threatActorsTable.$inferSelect;
export type InsertThreatActor = typeof threatActorsTable.$inferInsert;

export const threatsTable = pgTable("threats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  scanJobId: uuid("scan_job_id").references(() => scanJobsTable.id),
  /** Nullable FK to the shared threat actor record (null until matched). */
  threatActorId: uuid("threat_actor_id").references(() => threatActorsTable.id),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  platform: text("platform"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  details: text("details").notNull(),
  aiExplanation: text("ai_explanation"),
  threatScore: integer("threat_score").notNull().default(0),
  suspiciousUsername: text("suspicious_username"),
  matchedMediaCount: integer("matched_media_count").notNull().default(0),
  evidenceJson: text("evidence_json"),
  scoreBreakdownJson: text("score_breakdown_json"),
  detectedSignalsJson: text("detected_signals_json"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolveAction: text("resolve_action"),
  /**
   * dHash of the impersonator's profile picture, computed during scan Step 6.
   * Written at threat-creation time so linkThreatToActor can enrich the
   * actor's pHash cluster without a second image download.
   */
  impersonatorDHash: text("impersonator_d_hash"),
  hiddenUntilScan: boolean("hidden_until_scan").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertThreatSchema = createInsertSchema(threatsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertThreat = z.infer<typeof insertThreatSchema>;
export type Threat = typeof threatsTable.$inferSelect;

/**
 * Permanent per-user suppression list.
 * Written when a threat is resolved (any action). Never auto-cleared.
 * The scan pipeline reads this table first so already-dismissed accounts
 * are filtered before any expensive API or AI work runs.
 */
export const suppressedAccountsTable = pgTable(
  "suppressed_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    username: text("username").notNull(),
    resolveAction: text("resolve_action"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("suppressed_accounts_user_platform_username_idx").on(
      table.userId,
      table.platform,
      table.username
    ),
  ]
);

export const devicePushTokensTable = pgTable("device_push_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  platform: text("platform").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DevicePushToken = typeof devicePushTokensTable.$inferSelect;

// ─── Cost & Rate-Limiting tables ─────────────────────────────────────────────

export const scanCacheTable = pgTable("scan_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  cacheKey: text("cache_key").notNull().unique(),
  resultJson: text("result_json").notNull(),
  hitCount: integer("hit_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ScanCache = typeof scanCacheTable.$inferSelect;

export const apiCostLogTable = pgTable("api_cost_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  operation: text("operation").notNull(),
  costUsd: text("cost_usd").notNull().default("0"),
  tokensUsed: integer("tokens_used").notNull().default(0),
  cacheHit: boolean("cache_hit").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ApiCostLog = typeof apiCostLogTable.$inferSelect;

export const usageQuotasTable = pgTable("usage_quotas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(),
  scansThisMonth: integer("scans_this_month").notNull().default(0),
  deepScansToday: integer("deep_scans_today").notNull().default(0),
  monthKey: text("month_key").notNull().default(""),
  dayKey: text("day_key").notNull().default(""),
  flaggedForAbuse: boolean("flagged_for_abuse").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type UsageQuota = typeof usageQuotasTable.$inferSelect;

// ─── Identity Embeddings (cross-user similarity layer) ────────────────────────

/**
 * Per-image embedding vectors stored as JSON text arrays (number[]).
 * One row per (userId, imageUrl) pair.
 * Designed for future upgrade to pgvector native type + HNSW index.
 * For now, cross-user similarity runs via in-memory cosine comparison.
 */
export const identityEmbeddingsTable = pgTable("identity_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  /** JSON-serialised number[] — text for now, ready for vector(1536) migration. */
  embeddingJson: text("embedding_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IdentityEmbedding = typeof identityEmbeddingsTable.$inferSelect;

// ─── Developer API Platform ───────────────────────────────────────────────────

/**
 * External API keys for the /api/v1/* developer platform.
 * Key is stored as a SHA-256 hex digest; plaintext is returned only at creation.
 * Key format shown to users: sid_live_<prefix> where prefix is the first 8 chars of the random hex.
 */
export const apiKeysTable = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /** SHA-256 hex digest of the raw secret. */
  keyHash: text("key_hash").notNull().unique(),
  /** First 8 chars of the raw hex — safe to display for identification. */
  keyPrefix: text("key_prefix").notNull(),
  name: text("name").notNull().default("Default"),
  /** Max requests per minute. Defaults to 60. */
  rateLimitRpm: integer("rate_limit_rpm").notNull().default(60),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export type ApiKey = typeof apiKeysTable.$inferSelect;

/**
 * Registered webhook endpoints per API key.
 * Receives signed JSON POST payloads for threat.detected and scan.completed events.
 */
export const webhooksTable = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .references(() => apiKeysTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  /** JSON array of subscribed event types. */
  eventsJson: text("events_json").notNull().default('["threat.detected","scan.completed"]'),
  /** HMAC-SHA256 signing secret — shown to user once at registration. */
  signingSecret: text("signing_secret").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Webhook = typeof webhooksTable.$inferSelect;

/**
 * Log of every webhook delivery attempt.
 * Used for retry logic and delivery auditing.
 */
export const webhookDeliveryLogTable = pgTable("webhook_delivery_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooksTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  /** JSON-serialised event payload. */
  payloadJson: text("payload_json").notNull(),
  /** "pending" | "delivered" | "failed" */
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  responseCode: integer("response_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WebhookDeliveryLog = typeof webhookDeliveryLogTable.$inferSelect;

/**
 * Sliding-window rate limit counters for API keys.
 * One row per (keyId, 1-minute window bucket).
 * Rows older than 2 minutes are pruned lazily on each request.
 */
export const apiKeyRateLimitsTable = pgTable("api_key_rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyId: uuid("key_id")
    .notNull()
    .references(() => apiKeysTable.id, { onDelete: "cascade" }),
  /** Truncated to the minute: floor(Date.now() / 60000) * 60000 */
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1),
});

export type ApiKeyRateLimit = typeof apiKeyRateLimitsTable.$inferSelect;

export const waitlistSignupsTable = pgTable("waitlist_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type WaitlistSignup = typeof waitlistSignupsTable.$inferSelect;

// ─── pHash intelligence tables ────────────────────────────────────────────────

/**
 * Stores each user's own computed dHash fingerprints, one row per photo.
 *
 * Hashes are computed once and reused across all subsequent scans — no
 * re-downloading from CDN on every run.  Stable even after CDN URL rotation.
 * Unique on (userId, platformMediaId) so concurrent scans are safe.
 */
export const userPhotoHashesTable = pgTable(
  "user_photo_hashes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => connectedAccountsTable.id, {
      onDelete: "set null",
    }),
    /** Stable identifier: platform media ID or `url:<url>` fallback. */
    platformMediaId: text("platform_media_id").notNull(),
    /** 16-char hex dHash — computed once, never changes for the same image. */
    dHash: text("d_hash").notNull(),
    /** JSON float[] — semantic embedding vector (nullable; computed async). */
    embeddingJson: text("embedding_json"),
    /** CDN URL at time of indexing — for reference/refresh only. */
    sourceUrl: text("source_url"),
    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("user_photo_hashes_user_media_idx").on(
      table.userId,
      table.platformMediaId
    ),
  ]
);

export type UserPhotoHash = typeof userPhotoHashesTable.$inferSelect;
export type InsertUserPhotoHash = typeof userPhotoHashesTable.$inferInsert;

/**
 * Records user resolve-action feedback for each threat.
 * Drives per-user Hamming distance threshold tuning:
 *   false_positive → widen threshold (fewer false alarms)
 *   true_positive  → threshold stays tight (real threats are being found)
 */
export const phashFeedbackTable = pgTable("phash_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /** The threat this feedback is attached to (nullable if threat was deleted). */
  threatId: uuid("threat_id").references(() => threatsTable.id, {
    onDelete: "set null",
  }),
  /** The impersonator's dHash that triggered (or didn't trigger) the match. */
  candidateDHash: text("candidate_d_hash"),
  candidateUsername: text("candidate_username"),
  platform: text("platform"),
  /**
   * Outcome of the user's resolve action:
   *   true_positive     — real threat, correctly detected
   *   false_positive    — not a real threat (widen threshold)
   *   approved_contact  — known contact, permanently suppress (no threshold change)
   *   resolved_manually — handled outside the app (no threshold signal)
   */
  outcome: text("outcome").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PhashFeedback = typeof phashFeedbackTable.$inferSelect;

// ─── Cross-platform Identity Verification ─────────────────────────────────────

/**
 * Per-user canonical identity anchor.
 * Built by hashing profile/post photos across all connected accounts and
 * computing cross-platform Hamming similarity to form a consensus fingerprint.
 *
 * Updated fire-and-forget after every scan completion.
 * Companies integrating the API can read this to verify their user's identity
 * across all claimed social accounts without storing any photos.
 */
export const userIdentityProfilesTable = pgTable("user_identity_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(),
  /**
   * JSON string[] — consensus hash set derived from cross-platform agreement.
   * Only hashes confirmed across ≥2 platforms are included.
   */
  canonicalHashClusterJson: text("canonical_hash_cluster_json")
    .notNull()
    .default("[]"),
  /** 0–100 cross-platform visual consistency score. */
  overallConfidence: integer("overall_confidence").notNull().default(0),
  /** Number of platforms where identity is verified. */
  verifiedPlatformCount: integer("verified_platform_count").notNull().default(0),
  /** Total hashes in the canonical anchor cluster. */
  anchorHashCount: integer("anchor_hash_count").notNull().default(0),
  /** UNVERIFIED | LOW | MEDIUM | HIGH | STRONG */
  confidenceTier: text("confidence_tier").notNull().default("UNVERIFIED"),
  lastComputedAt: timestamp("last_computed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserIdentityProfile =
  typeof userIdentityProfilesTable.$inferSelect;
export type InsertUserIdentityProfile =
  typeof userIdentityProfilesTable.$inferInsert;

/**
 * Per-platform verification record for a user.
 * One row per (userId, platform) — upserted after every scan.
 *
 * visualMatchScore = % of this platform's hashes within Hamming threshold of
 *   the canonical anchor cluster.
 * metadataMatchScore = cross-reference consistency (bio links, handle mentions).
 */
export const platformVerificationsTable = pgTable(
  "platform_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    username: text("username").notNull(),
    /** 0–100: fraction of this platform's hashes matching the anchor cluster. */
    visualMatchScore: integer("visual_match_score").notNull().default(0),
    /** 0–100: bio/link consistency with other platforms (future: cross-ref). */
    metadataMatchScore: integer("metadata_match_score").notNull().default(50),
    /** How many photo hashes back this platform's verification. */
    hashCount: integer("hash_count").notNull().default(0),
    /** visual_hash_consensus | single_platform | unverified */
    verificationMethod: text("verification_method")
      .notNull()
      .default("unverified"),
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("platform_verifications_user_platform_idx").on(
      table.userId,
      table.platform
    ),
  ]
);

export type PlatformVerification =
  typeof platformVerificationsTable.$inferSelect;
