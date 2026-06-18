import {
  boolean,
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
