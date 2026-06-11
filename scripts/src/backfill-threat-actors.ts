/**
 * Backfill script: link all existing unlinked threat records to threat actors.
 * Self-contained — uses pg directly to stay within scripts rootDir.
 * Safe to re-run (skips already-linked threats).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run backfill:actors
 *   pnpm --filter @workspace/scripts run backfill:actors -- --dry-run
 */

import pg from "pg";

const { Client } = pg;

const dryRun = process.argv.includes("--dry-run");

// ─── Levenshtein (no external dep) ───────────────────────────────────────────

function editDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) { costs[j] = j; }
      else if (j > 0) {
        let nv = costs[j - 1]!;
        if (s1[i - 1] !== s2[j - 1]) nv = Math.min(Math.min(nv, lastValue), costs[j]!) + 1;
        costs[j - 1] = lastValue;
        lastValue = nv;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length] ?? 0;
}

function confidence(victimCount: number, platforms: string[]): number {
  return Math.min(100, victimCount * 15 + new Set(platforms).size * 5);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log(`Running threat actor backfill${dryRun ? " (DRY RUN)" : ""}...`);

// Load all unlinked threats
const { rows: unlinked } = await client.query<{
  id: string; suspicious_username: string | null; platform: string | null;
}>(`SELECT id, suspicious_username, platform FROM threats WHERE threat_actor_id IS NULL LIMIT 1000`);

console.log(`Found ${unlinked.length} unlinked threats`);

// Load all existing actors
const { rows: actors } = await client.query<{
  id: string; canonical_username: string | null; victim_count: number; platform_set_json: string;
}>(`SELECT id, canonical_username, victim_count, platform_set_json FROM threat_actors`);

let linked = 0;
let skipped = 0;

for (const threat of unlinked) {
  if (!threat.suspicious_username) { skipped++; continue; }
  const cleanName = threat.suspicious_username.replace(/^@/, "").toLowerCase();

  let bestMatch: (typeof actors)[0] | null = null;
  let bestDist = Infinity;

  for (const actor of actors) {
    if (!actor.canonical_username) continue;
    const dist = editDistance(cleanName, actor.canonical_username);
    const platforms = JSON.parse(actor.platform_set_json ?? "[]") as string[];
    const samePlatform = threat.platform && platforms.includes(threat.platform);
    if ((samePlatform && dist <= 3) || dist <= 1) {
      if (dist < bestDist) { bestMatch = actor; bestDist = dist; }
    }
  }

  if (dryRun) {
    console.log(`[DRY RUN] ${threat.id}: would link to ${bestMatch ? bestMatch.id : "NEW actor"}`);
    linked++;
    continue;
  }

  if (bestMatch) {
    const platforms = JSON.parse(bestMatch.platform_set_json ?? "[]") as string[];
    if (threat.platform && !platforms.includes(threat.platform)) platforms.push(threat.platform);
    const newCount = bestMatch.victim_count + 1;
    await client.query(
      `UPDATE threat_actors SET victim_count=$1, platform_set_json=$2, last_seen=NOW(), confidence_score=$3 WHERE id=$4`,
      [newCount, JSON.stringify(platforms), confidence(newCount, platforms), bestMatch.id]
    );
    await client.query(`UPDATE threats SET threat_actor_id=$1 WHERE id=$2`, [bestMatch.id, threat.id]);
    bestMatch.victim_count = newCount;
    linked++;
  } else {
    const platforms = threat.platform ? [threat.platform] : [];
    const { rows: [created] } = await client.query<{ id: string }>(
      `INSERT INTO threat_actors(canonical_username, victim_count, platform_set_json, confidence_score, first_seen, last_seen)
       VALUES($1, 1, $2, $3, NOW(), NOW()) RETURNING id`,
      [cleanName, JSON.stringify(platforms), confidence(1, platforms)]
    );
    if (created) {
      await client.query(`UPDATE threats SET threat_actor_id=$1 WHERE id=$2`, [created.id, threat.id]);
      actors.push({ id: created.id, canonical_username: cleanName, victim_count: 1, platform_set_json: JSON.stringify(platforms) });
      linked++;
    } else {
      skipped++;
    }
  }
}

await client.end();
console.log(`\n✅ Done — linked: ${linked}, skipped: ${skipped}`);
