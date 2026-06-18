/**
 * pHash Intelligence Service
 *
 * Cross-user threat intelligence layer. Every scan enriches a shared corpus of
 * impersonator fingerprints stored in threat_actors.pHashClusterJson.
 *
 * FAST PATH (zero AI cost):
 *   Compute candidate dHash → check all actor clusters → instant match if
 *   a prior user already flagged this impersonator. Skips GPT-4o entirely.
 *
 * FEEDBACK PATH (per-user accuracy tuning):
 *   User resolve actions write to phash_feedback.
 *   false_positive → widen per-user Hamming threshold (fewer false alarms)
 *   true_positive  → keep threshold tight (real threats are being found)
 *
 * NETWORK EFFECT:
 *   First user to encounter an impersonator pays the GPT-4o cost.
 *   Every subsequent user gets instant detection via the cluster.
 *   Detection quality compounds with user count — no photos stored.
 */

import { eq, desc } from "drizzle-orm";
import {
  db,
  threatActorsTable,
  phashFeedbackTable,
  type ThreatActor,
} from "@workspace/db";
import { hammingDistance } from "./photoHashService";
import { logger } from "../lib/logger";

// Default Hamming distance threshold: ≤10 → similarity ≥ 0.84
// Catches minor crops, compression artefacts, slight colour shifts.
export const DEFAULT_HAMMING_THRESHOLD = 10;

// ─── Actor hash enrichment ─────────────────────────────────────────────────────

/**
 * Add an impersonator's dHash to a threat actor's known-bad-actor cluster.
 * Deduplicates: an identical hash (distance 0) is never written twice.
 * Called every time a confirmed threat is linked to an actor — this is the
 * primary mechanism by which the intelligence corpus grows.
 */
export async function enrichActorWithHash(
  actorId: string,
  dHash: string
): Promise<void> {
  if (!dHash || dHash.length !== 16) return;
  try {
    const [actor] = await db
      .select({ pHashClusterJson: threatActorsTable.pHashClusterJson })
      .from(threatActorsTable)
      .where(eq(threatActorsTable.id, actorId));

    if (!actor) return;

    const cluster = parseHashCluster(actor.pHashClusterJson);
    const isDuplicate = cluster.some((h) => hammingDistance(h, dHash) === 0);
    if (isDuplicate) return;

    cluster.push(dHash);
    await db
      .update(threatActorsTable)
      .set({ pHashClusterJson: JSON.stringify(cluster), lastSeen: new Date() })
      .where(eq(threatActorsTable.id, actorId));

    logger.info(
      { actorId, clusterSize: cluster.length },
      "Actor pHash cluster enriched"
    );
  } catch (err) {
    logger.warn({ err, actorId }, "Actor hash enrichment failed (non-fatal)");
  }
}

// ─── Fast-path actor lookup ────────────────────────────────────────────────────

export interface ActorHashMatch {
  actor: ThreatActor;
  matchedHash: string;
  distance: number;
  /** 0–100 similarity derived from distance */
  similarity: number;
}

/**
 * Find the first threat actor whose pHash cluster contains a hash within
 * `maxHammingDistance` of the given dHash.
 *
 * Returns null when no actor matches — caller should fall through to GPT-4o.
 * Returns the closest match when multiple actors are within the threshold.
 *
 * Zero external API calls. Pure DB + in-memory Hamming comparison.
 */
export async function findActorByHash(
  dHash: string,
  maxHammingDistance = DEFAULT_HAMMING_THRESHOLD
): Promise<ActorHashMatch | null> {
  if (!dHash || dHash.length !== 16) return null;

  // Load actors with non-empty clusters, sorted by confidence (highest first)
  // so we check the most-trusted actors first and can short-circuit early.
  const actors = await db
    .select()
    .from(threatActorsTable)
    .orderBy(desc(threatActorsTable.confidenceScore))
    .limit(2000);

  let bestMatch: ActorHashMatch | null = null;

  for (const actor of actors) {
    const cluster = parseHashCluster(actor.pHashClusterJson);
    if (cluster.length === 0) continue;

    for (const knownHash of cluster) {
      const dist = hammingDistance(dHash, knownHash);
      if (dist <= maxHammingDistance) {
        const sim = Math.max(0, 1 - dist / 64);
        if (!bestMatch || dist < bestMatch.distance) {
          bestMatch = { actor, matchedHash: knownHash, distance: dist, similarity: sim };
        }
        if (dist === 0) break; // perfect match — can't improve
      }
    }

    if (bestMatch?.distance === 0) break;
  }

  if (bestMatch) {
    logger.info(
      {
        actorId: bestMatch.actor.id,
        username: bestMatch.actor.canonicalUsername,
        distance: bestMatch.distance,
        similarity: Math.round(bestMatch.similarity * 100),
        victimCount: bestMatch.actor.victimCount,
      },
      "Fast-path actor match via pHash cluster"
    );
  }

  return bestMatch;
}

// ─── User feedback & threshold tuning ─────────────────────────────────────────

export type FeedbackOutcome =
  | "true_positive"
  | "false_positive"
  | "approved_contact"
  | "resolved_manually";

/**
 * Record user feedback for a resolved threat's pHash.
 * Written fire-and-forget from the resolve endpoint — non-fatal on error.
 */
export async function recordPhashFeedback(
  userId: string,
  threatId: string,
  candidateDHash: string | null,
  candidateUsername: string | null,
  platform: string | null,
  outcome: FeedbackOutcome
): Promise<void> {
  try {
    await db.insert(phashFeedbackTable).values({
      userId,
      threatId,
      candidateDHash,
      candidateUsername,
      platform,
      outcome,
    });
    logger.info({ userId, outcome, candidateUsername }, "pHash feedback recorded");
  } catch (err) {
    logger.warn({ err, userId }, "pHash feedback write failed (non-fatal)");
  }
}

/**
 * Compute a per-user Hamming distance threshold adjusted by their feedback history.
 *
 * Each false_positive adds +2 (be more lenient — they're seeing too many false alarms).
 * Each true_positive adds -1 (stay tight — real threats are being caught correctly).
 * Capped at ±8 from DEFAULT_HAMMING_THRESHOLD (2 – 18 range).
 *
 * Falls back to DEFAULT_HAMMING_THRESHOLD on error.
 */
export async function computeUserThreshold(
  userId: string,
  isFirstScan = false
): Promise<number> {
  try {
    const feedback = await db
      .select({ outcome: phashFeedbackTable.outcome })
      .from(phashFeedbackTable)
      .where(eq(phashFeedbackTable.userId, userId));

    const fp = feedback.filter((f) => f.outcome === "false_positive").length;
    const tp = feedback.filter((f) => f.outcome === "true_positive").length;
    const adjustment = fp * 2 - tp;
    const clamped = Math.max(-8, Math.min(8, adjustment));
    const computed = DEFAULT_HAMMING_THRESHOLD + clamped;
    // First scan uses a tighter gate — only near-identical hashes qualify
    return isFirstScan ? Math.min(computed, 6) : computed;
  } catch {
    return isFirstScan ? 6 : DEFAULT_HAMMING_THRESHOLD;
  }
}

// ─── Platform-level intelligence stats ────────────────────────────────────────

export interface IntelligenceStats {
  totalThreatActors: number;
  actorsWithHashClusters: number;
  totalHashesIndexed: number;
  totalVictimCount: number;
  avgConfidenceScore: number;
  topPlatforms: Array<{ platform: string; count: number }>;
  recentActors: Array<{
    id: string;
    canonicalUsername: string | null;
    victimCount: number;
    confidenceScore: number;
    platforms: string[];
    clusterSize: number;
    lastSeen: string;
  }>;
}

export async function getIntelligenceStats(): Promise<IntelligenceStats> {
  const actors = await db
    .select()
    .from(threatActorsTable)
    .orderBy(desc(threatActorsTable.confidenceScore))
    .limit(500);

  const withClusters = actors.filter(
    (a) => parseHashCluster(a.pHashClusterJson).length > 0
  );
  const totalHashes = actors.reduce(
    (sum, a) => sum + parseHashCluster(a.pHashClusterJson).length,
    0
  );
  const totalVictims = actors.reduce((sum, a) => sum + a.victimCount, 0);
  const avgConfidence =
    actors.length > 0
      ? Math.round(
          actors.reduce((sum, a) => sum + a.confidenceScore, 0) / actors.length
        )
      : 0;

  const platformCounts = new Map<string, number>();
  for (const actor of actors) {
    for (const p of parseStringArray(actor.platformSetJson)) {
      platformCounts.set(p, (platformCounts.get(p) ?? 0) + 1);
    }
  }
  const topPlatforms = [...platformCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([platform, count]) => ({ platform, count }));

  const recentActors = actors.slice(0, 20).map((a) => ({
    id: a.id,
    canonicalUsername: a.canonicalUsername,
    victimCount: a.victimCount,
    confidenceScore: a.confidenceScore,
    platforms: parseStringArray(a.platformSetJson),
    clusterSize: parseHashCluster(a.pHashClusterJson).length,
    lastSeen: a.lastSeen.toISOString(),
  }));

  return {
    totalThreatActors: actors.length,
    actorsWithHashClusters: withClusters.length,
    totalHashesIndexed: totalHashes,
    totalVictimCount: totalVictims,
    avgConfidenceScore: avgConfidence,
    topPlatforms,
    recentActors,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseHashCluster(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as string[]) : [];
  } catch {
    return [];
  }
}

export function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as string[]) : [];
  } catch {
    return [];
  }
}
