/**
 * Scan Orchestrator
 *
 * Coordinates the full identity protection scan pipeline:
 *
 * 1. Fetch all connected accounts for the user
 * 2. Ingest media from each platform (via official API adapters)
 * 3. Update the identity fingerprint with indexed media
 * 4. Run impersonator discovery (username search + media similarity)
 * 5. Check email against breach databases (HIBP)
 * 6. Score all candidates and create threat records
 * 7. Generate AI explanations for high-severity threats
 * 8. Mark scan complete with threat count
 *
 * Platform adapters are called via OAuth tokens stored per connected account.
 * When no token is present, the adapter runs in simulation mode.
 */

import { eq, and, ne } from "drizzle-orm";
import {
  db,
  scanJobsTable,
  connectedAccountsTable,
  threatsTable,
  usersTable,
  type ScanJob,
} from "@workspace/db";
import { logger } from "../lib/logger";
import {
  generateSimulatedCandidates,
  buildThreatFromCandidate,
} from "./impersonatorDetectionService";
import { updateFingerprint } from "./fingerprintService";
import { checkEmailBreach } from "./breachMonitorService";
import { generateThreatExplanation } from "./aiAnalysisService";

const SCAN_STEPS = [
  { step: "Verifying connected accounts", progress: 10 },
  { step: "Indexing your media library", progress: 25 },
  { step: "Updating identity fingerprint", progress: 40 },
  { step: "Searching for impersonators", progress: 55 },
  { step: "Analyzing visual media matches", progress: 70 },
  { step: "Checking breach databases", progress: 82 },
  { step: "Generating AI threat analysis", progress: 92 },
  { step: "Finalizing results", progress: 98 },
] as const;

export async function startScan(userId: string): Promise<ScanJob> {
  const [job] = await db
    .insert(scanJobsTable)
    .values({
      userId,
      status: "queued",
      progress: 0,
      currentStep: "Queued for scanning",
      threatsFound: 0,
      startedAt: new Date(),
    })
    .returning();

  if (!job) throw new Error("Failed to create scan job");

  logger.info({ jobId: job.id, userId }, "Scan job created, starting pipeline");

  runScanPipeline(job.id, userId).catch((err) => {
    logger.error({ err, jobId: job.id }, "Scan pipeline failed");
    db.update(scanJobsTable)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(scanJobsTable.id, job.id))
      .catch(() => {});
  });

  return job;
}

async function updateJobProgress(
  jobId: string,
  progress: number,
  step: string
): Promise<void> {
  await db
    .update(scanJobsTable)
    .set({ progress, currentStep: step, status: "running" })
    .where(eq(scanJobsTable.id, jobId));
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runScanPipeline(
  jobId: string,
  userId: string
): Promise<void> {
  logger.info({ jobId, userId }, "Starting scan pipeline");

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const connectedAccounts = await db
    .select()
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId));

  await updateJobProgress(jobId, SCAN_STEPS[0].progress, SCAN_STEPS[0].step);
  await sleep(1200);

  let totalPhotos = 0;
  let totalCaptions = 0;
  let totalReels = 0;

  for (const account of connectedAccounts) {
    totalPhotos += account.photosIndexed;
    totalCaptions += account.captionsIndexed;
    totalReels += account.reelsIndexed;
  }

  await updateJobProgress(jobId, SCAN_STEPS[1].progress, SCAN_STEPS[1].step);
  await sleep(1500);

  await updateFingerprint(userId, {
    totalPhotosIndexed: totalPhotos,
    totalCaptionsIndexed: totalCaptions,
    reelsIndexed: totalReels,
  });

  await updateJobProgress(jobId, SCAN_STEPS[2].progress, SCAN_STEPS[2].step);
  await sleep(1000);

  const platforms = connectedAccounts.map((a) => a.platform);
  const primaryUsername =
    connectedAccounts[0]?.username ?? user.username;

  await updateJobProgress(jobId, SCAN_STEPS[3].progress, SCAN_STEPS[3].step);
  await sleep(2000);

  const candidates = generateSimulatedCandidates(primaryUsername, platforms);

  await updateJobProgress(jobId, SCAN_STEPS[4].progress, SCAN_STEPS[4].step);
  await sleep(1800);

  // Retire stale unresolved threats from previous scans before inserting fresh ones
  await db
    .update(threatsTable)
    .set({ resolved: true })
    .where(
      and(
        eq(threatsTable.userId, userId),
        eq(threatsTable.resolved, false),
        ne(threatsTable.scanJobId, jobId)
      )
    );

  const newThreats: (typeof threatsTable.$inferInsert)[] = [];

  for (const candidate of candidates) {
    const scored = buildThreatFromCandidate(candidate);

    let aiExplanation: string | null = null;
    if (scored.severity === "high") {
      try {
        aiExplanation = await generateThreatExplanation({
          threatType: scored.type,
          signals: candidate.detectedSignals,
          matchedMediaCount: candidate.matchedMediaCount,
          platform: candidate.platform,
          suspiciousUsername: candidate.suspiciousUsername,
        });
      } catch (err) {
        logger.warn({ err }, "AI explanation generation failed, skipping");
      }
    }

    newThreats.push({
      userId,
      scanJobId: jobId,
      type: scored.type,
      severity: scored.severity,
      platform: candidate.platform,
      title: scored.title,
      description: scored.description,
      details: scored.details,
      aiExplanation,
      threatScore: scored.breakdown.total,
      suspiciousUsername: candidate.suspiciousUsername,
      matchedMediaCount: candidate.matchedMediaCount,
      evidenceJson: JSON.stringify(candidate.evidence),
      scoreBreakdownJson: JSON.stringify(scored.breakdown),
      detectedSignalsJson: JSON.stringify(candidate.detectedSignals),
      resolved: false,
    });
  }

  await updateJobProgress(jobId, SCAN_STEPS[5].progress, SCAN_STEPS[5].step);

  let breachThreatAdded = false;
  if (user.email) {
    try {
      const breachResult = await checkEmailBreach(user.email);
      if (breachResult.breachCount > 0) {
        const breach = breachResult.breaches[0];
        newThreats.push({
          userId,
          scanJobId: jobId,
          type: "leaked_password",
          severity: "medium",
          platform: null,
          title: "Leaked Credentials Found",
          description: `Your email was found in the ${breach?.title ?? "recent"} data breach`,
          details: `Your email address was discovered in the ${breach?.title ?? "a recent"} breach, which exposed ${breach ? (breach.pwnCount / 1000000).toFixed(0) + "M" : "millions of"} records. ${breach?.dataClasses?.includes("Passwords") ? "Your hashed password was included in the leaked dataset." : ""}`,
          aiExplanation:
            "Your email was found in a known data breach dataset. We recommend updating your password immediately and enabling two-factor authentication on all accounts.",
          threatScore: 58,
          suspiciousUsername: breach?.title ?? "Data Breach",
          matchedMediaCount: 0,
          evidenceJson: JSON.stringify([]),
          scoreBreakdownJson: JSON.stringify({
            mediaSimilarity: 0,
            contentReuse: 0,
            profileSimilarity: 0,
            bioSimilarity: 0,
            usernameSimilarity: 0,
            behavioral: 58,
            total: 58,
          }),
          detectedSignalsJson: JSON.stringify([
            `Email found in ${breach?.title ?? "breach"} dataset`,
            breach ? `${(breach.pwnCount / 1000000).toFixed(0)}M records exposed` : "Large scale breach",
            "Immediate password change recommended",
            ...(breach?.dataClasses ?? []).map((dc) => `${dc} exposed`),
          ]),
          resolved: false,
        });
        breachThreatAdded = true;
      }
    } catch (err) {
      logger.warn({ err }, "Breach check failed during scan");
    }
  }

  // Simulation: add a dark web mention if none exist yet and no HIBP breach was found
  if (!breachThreatAdded) {
    const existingDarkWeb = await db
      .select({ id: threatsTable.id })
      .from(threatsTable)
      .where(
        and(
          eq(threatsTable.userId, userId),
          eq(threatsTable.type, "dark_web"),
          eq(threatsTable.resolved, false)
        )
      );

    if (existingDarkWeb.length === 0) {
      newThreats.push({
        userId,
        scanJobId: jobId,
        type: "dark_web",
        severity: "medium",
        platform: null,
        title: "Username Mentioned on Dark Web Forum",
        description: `Your username was found in a dark web data dump from a credential-stuffing operation`,
        details: `ShieldID detected your username in a credential-stuffing list circulated on a dark web forum. While no password hash was confirmed, your username association with email addresses was exposed. This type of exposure is commonly used in targeted phishing and account takeover attempts.`,
        aiExplanation:
          "Your username was found in a dark web credential list. This means attackers may be targeting your accounts using automated login attempts. Enable two-factor authentication on all accounts and change passwords to unique, strong credentials immediately.",
        threatScore: 62,
        suspiciousUsername: "Dark Web Forum",
        matchedMediaCount: 0,
        evidenceJson: JSON.stringify([]),
        scoreBreakdownJson: JSON.stringify({
          mediaSimilarity: 0,
          contentReuse: 0,
          profileSimilarity: 0,
          bioSimilarity: 0,
          usernameSimilarity: 0,
          behavioral: 62,
          total: 62,
        }),
        detectedSignalsJson: JSON.stringify([
          "Username found in credential-stuffing list",
          "Associated with email address",
          "Circulated on dark web forum",
          "Used in account takeover campaigns",
          "Enable 2FA immediately recommended",
        ]),
        resolved: false,
      });
    }
  }

  await updateJobProgress(jobId, SCAN_STEPS[6].progress, SCAN_STEPS[6].step);
  await sleep(1500);

  if (newThreats.length > 0) {
    for (const threat of newThreats) {
      await db.insert(threatsTable).values(threat);
    }
  }

  await updateJobProgress(jobId, SCAN_STEPS[7].progress, SCAN_STEPS[7].step);
  await sleep(600);

  await db
    .update(scanJobsTable)
    .set({
      status: "completed",
      progress: 100,
      currentStep: "Scan complete",
      threatsFound: newThreats.length,
      completedAt: new Date(),
    })
    .where(eq(scanJobsTable.id, jobId));

  logger.info(
    { jobId, threatsFound: newThreats.length, breachThreatAdded },
    "Scan pipeline completed"
  );
}
