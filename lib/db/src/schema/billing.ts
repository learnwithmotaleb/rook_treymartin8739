import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./shield";


export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(),
  tier: text("tier").notNull().default("free"),
  status: text("status").notNull().default("active"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;

export const usageTrackingTable = pgTable(
  "usage_tracking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    scansUsed: integer("scans_used").notNull().default(0),
    accountsConnected: integer("accounts_connected").notNull().default(0),
    alertsSent: integer("alerts_sent").notNull().default(0),
    aiCallsMade: integer("ai_calls_made").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("usage_user_period").on(t.userId, t.period)]
);

export type UsageTracking = typeof usageTrackingTable.$inferSelect;

export const cancellationFeedbackTable = pgTable("cancellation_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CancellationFeedback = typeof cancellationFeedbackTable.$inferSelect;

export const scheduledNotificationsTable = pgTable(
  "scheduled_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
    fired: boolean("fired").notNull().default(false),
    cancelled: boolean("cancelled").notNull().default(false),
    data: text("data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("scheduled_notifs_user_id_idx").on(t.userId),
    index("scheduled_notifs_fire_at_idx").on(t.fireAt, t.fired),
  ]
);

export type ScheduledNotification = typeof scheduledNotificationsTable.$inferSelect;
