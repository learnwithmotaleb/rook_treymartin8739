/**
 * Threat Actor Service
 *
 * Correlates threat records across users to build shared bad-actor records.
 * When multiple users are targeted by usernames that are within Levenshtein
 * distance 3 of each other on the same platform, they're grouped under one
 * threat_actor row. Confidence grows with each additional victim.
 *
 * Zero external API calls — all matching uses data already stored in the DB.
 */

import { eq, and, isNull } from "drizzle-orm";
import {
  db,
  threatActorsTable,
  threatsTable,
  type ThreatActor,
} from "@workspace/db";
import { enrichActorWithHash } from "./phashIntelligenceService";
import { logger } from "../lib/logger";

// ─── Levenshtein (reused from scanOrchestrator, no external dep) ──────────────

function editDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1]!;
        if (s1[i - 1] !== s2[j - 1]) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]!) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length] ?? 0;
}

function usernameSimilarityDistance(a: string, b: string): number {
  const s1 = a.replace(/^@/, "").toLowerCase();
  const s2 = b.replace(/^@/, "").toLowerCase();
  return editDistance(s1, s2);
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

function computeConfidence(victimCount: number, platforms: string[]): number {
  const uniquePlatforms = new Set(platforms).size;
  return Math.min(100, victimCount * 15 + uniquePlatforms * 5);
}

// ─── Core match-or-create logic ───────────────────────────────────────────────

/**
 * Given a newly-inserted threat, find the best matching threat actor or create one.
 * Links the threat to the actor via threatActorId FK.
 *
 * Matching criteria (either condition triggers a match):
 *   - Same platform + Levenshtein distance ≤ 3 on suspicious username
 *   - Levenshtein distance ≤ 1 (near-exact match) regardless of platform
 */
/**
 * Link a threat to a shared threat actor and optionally enrich that actor's
 * pHash cluster with the impersonator's visual fingerprint.
 *
 * @param impersonatorDHash - 16-char hex dHash of the impersonator's profile
 *   picture; when provided it is added to the actor's pHash cluster so future
 *   scans can match this actor by hash alone (zero AI calls).
 */
export async function linkThreatToActor(
  threatId: string,
  suspiciousUsername: string,
  platform: string | null,
  impersonatorDHash?: string | null
): Promise<ThreatActor | null> {
  if (!suspiciousUsername) return null;

  const cleanUsername = suspiciousUsername.replace(/^@/, "").toLowerCase();

  try {
    // Load all existing actors for comparison (in-memory Levenshtein)
    const actors = await db
      .select()
      .from(threatActorsTable)
      .limit(500); // cap at 500 actors for efficiency; sufficient for early scale

    let bestMatch: ThreatActor | null = null;
    let bestDistance = Infinity;

    for (const actor of actors) {
      if (!actor.canonicalUsername) continue;
      const dist = usernameSimilarityDistance(cleanUsername, actor.canonicalUsername);

      const samePlatform = platform && (
        JSON.parse(actor.platformSetJson ?? "[]") as string[]
      ).includes(platform);

      const isMatch =
        (samePlatform && dist <= 3) ||
        dist <= 1;

      if (isMatch && dist < bestDistance) {
        bestMatch = actor;
        bestDistance = dist;
      }
    }

    if (bestMatch) {
      // Update existing actor
      const currentPlatforms = JSON.parse(bestMatch.platformSetJson ?? "[]") as string[];
      if (platform && !currentPlatforms.includes(platform)) {
        currentPlatforms.push(platform);
      }
      const newVictimCount = bestMatch.victimCount + 1;
      const newConfidence = computeConfidence(newVictimCount, currentPlatforms);

      const [updated] = await db
        .update(threatActorsTable)
        .set({
          victimCount: newVictimCount,
          platformSetJson: JSON.stringify(currentPlatforms),
          lastSeen: new Date(),
          confidenceScore: newConfidence,
        })
        .where(eq(threatActorsTable.id, bestMatch.id))
        .returning();

      if (updated) {
        await db
          .update(threatsTable)
          .set({ threatActorId: updated.id })
          .where(eq(threatsTable.id, threatId));

        // Enrich actor's pHash cluster with impersonator's visual fingerprint.
        // This is the core learning step: next user who encounters this actor
        // gets an instant cluster-match instead of a GPT-4o call.
        if (impersonatorDHash) {
          enrichActorWithHash(updated.id, impersonatorDHash).catch(() => {});
        }

        logger.info(
          { threatId, actorId: updated.id, victimCount: newVictimCount, confidence: newConfidence, hashProvided: Boolean(impersonatorDHash) },
          "Linked threat to existing actor"
        );
        return updated;
      }
    } else {
      // Create new actor
      const platforms = platform ? [platform] : [];
      const [created] = await db
        .insert(threatActorsTable)
        .values({
          canonicalUsername: cleanUsername,
          pHashClusterJson: "[]",
          victimCount: 1,
          platformSetJson: JSON.stringify(platforms),
          firstSeen: new Date(),
          lastSeen: new Date(),
          confidenceScore: computeConfidence(1, platforms),
        })
        .returning();

      if (created) {
        await db
          .update(threatsTable)
          .set({ threatActorId: created.id })
          .where(eq(threatsTable.id, threatId));

        // Seed the new actor's cluster with the impersonator's hash.
        if (impersonatorDHash) {
          enrichActorWithHash(created.id, impersonatorDHash).catch(() => {});
        }

        logger.info(
          { threatId, actorId: created.id, username: cleanUsername, hashProvided: Boolean(impersonatorDHash) },
          "Created new threat actor"
        );
        return created;
      }
    }
  } catch (err) {
    logger.warn({ err, threatId, suspiciousUsername }, "Threat actor linking failed");
  }

  return null;
}

// ─── Backfill helper ──────────────────────────────────────────────────────────

/**
 * Link all existing threat records that don't have a threatActorId yet.
 * Used by the one-time backfill script.
 */
export async function backfillThreatActors(dryRun = false): Promise<{ linked: number; skipped: number }> {
  const unlinked = await db
    .select({
      id: threatsTable.id,
      suspiciousUsername: threatsTable.suspiciousUsername,
      platform: threatsTable.platform,
    })
    .from(threatsTable)
    .where(isNull(threatsTable.threatActorId))
    .limit(1000);

  let linked = 0;
  let skipped = 0;

  for (const threat of unlinked) {
    if (!threat.suspiciousUsername) {
      skipped++;
      continue;
    }

    if (dryRun) {
      logger.info({ threatId: threat.id, username: threat.suspiciousUsername }, "[DRY RUN] Would link");
      linked++;
      continue;
    }

    const actor = await linkThreatToActor(
      threat.id,
      threat.suspiciousUsername,
      threat.platform
    );

    if (actor) {
      linked++;
    } else {
      skipped++;
    }
  }

  return { linked, skipped };
}

/**
 * Look up an existing threat actor by username + platform without modifying it.
 * Used for deterministic escalation checks: if an actor already exists for
 * this candidate (from any prior victim's scan), surface their victimCount
 * directly rather than relying on fast-path string tags.
 */
export async function findActorByUsername(
  suspiciousUsername: string,
  platform: string
): Promise<ThreatActor | null> {
  if (!suspiciousUsername) return null;
  const cleanUsername = suspiciousUsername.replace(/^@/, "").toLowerCase();

  try {
    const actors = await db
      .select()
      .from(threatActorsTable)
      .limit(500);

    let bestMatch: ThreatActor | null = null;
    let bestDistance = Infinity;

    for (const actor of actors) {
      if (!actor.canonicalUsername) continue;
      const dist = usernameSimilarityDistance(cleanUsername, actor.canonicalUsername);
      const samePlatform = (
        JSON.parse(actor.platformSetJson ?? "[]") as string[]
      ).includes(platform);
      const isMatch = (samePlatform && dist <= 3) || dist <= 1;
      if (isMatch && dist < bestDistance) {
        bestMatch = actor;
        bestDistance = dist;
      }
    }

    return bestMatch;
  } catch (err) {
    logger.warn({ err, suspiciousUsername }, "findActorByUsername failed (non-fatal)");
    return null;
  }
}
