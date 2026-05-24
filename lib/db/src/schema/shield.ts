import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
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
  isPremium: boolean("is_premium").notNull().default(false),
  securityScore: integer("security_score").notNull().default(72),
  scoreTrend: integer("score_trend").notNull().default(0),
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

export const threatsTable = pgTable("threats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  scanJobId: uuid("scan_job_id").references(() => scanJobsTable.id),
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
