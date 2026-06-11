/**
 * One-time migration: create infrastructure tables for the three upgrade tasks.
 * Safe to re-run (uses CREATE TABLE IF NOT EXISTS and ADD COLUMN IF NOT EXISTS).
 */

import pg from "pg";

const { Client } = pg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log("Running infrastructure migration...");

  try {
    // ── Task #15: Threat Intelligence Graph ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS threat_actors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        canonical_username TEXT,
        phash_cluster_json TEXT DEFAULT '[]',
        victim_count INTEGER NOT NULL DEFAULT 1,
        platform_set_json TEXT DEFAULT '[]',
        first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confidence_score INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✓ threat_actors table");

    await client.query(`
      ALTER TABLE threats
      ADD COLUMN IF NOT EXISTS threat_actor_id UUID REFERENCES threat_actors(id)
    `);
    console.log("✓ threats.threat_actor_id column");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_threat_actors_canonical_username
      ON threat_actors (canonical_username)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_threat_actors_victim_count
      ON threat_actors (victim_count DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_threats_threat_actor_id
      ON threats (threat_actor_id)
      WHERE threat_actor_id IS NOT NULL
    `);
    console.log("✓ threat actor indexes");

    // ── Task #16: Identity Embeddings (pgvector-ready) ───────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS identity_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✓ identity_embeddings table");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_identity_embeddings_user_id
      ON identity_embeddings (user_id)
    `);
    console.log("✓ identity_embeddings index");

    // ── Task #17: Developer API Platform ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'Default',
        rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ
      )
    `);
    console.log("✓ api_keys table");

    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        events_json TEXT NOT NULL DEFAULT '["threat.detected","scan.completed"]',
        signing_secret TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✓ webhooks table");

    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_delivery_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        response_code INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✓ webhook_delivery_log table");

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_key_rate_limits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        window_start TIMESTAMPTZ NOT NULL,
        count INTEGER NOT NULL DEFAULT 1
      )
    `);
    console.log("✓ api_key_rate_limits table");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_api_key_rate_limits_key_window
      ON api_key_rate_limits (key_id, window_start)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_webhook_delivery_log_retry
      ON webhook_delivery_log (status, next_retry_at)
      WHERE status = 'pending'
    `);
    console.log("✓ platform indexes");

    console.log("\n✅ Infrastructure migration complete.");
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
