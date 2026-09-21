import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, isNull, and, desc } from "drizzle-orm";
import sharp from "sharp";
import {
  db,
  usersTable,
  connectedAccountsTable,
  mediaItemsTable,
  scanJobsTable,
  threatsTable,
  photoProcessingConsentsTable,
  userPhotoHashesTable,
  identityEmbeddingsTable,
  visualFingerprintsTable,
  phashFeedbackTable,
  userIdentityProfilesTable,
} from "@workspace/db";

import { getFingerprintForUser } from "../services/fingerprintService";
import { getSubscription } from "../services/subscriptionService";
import { recalculateScore } from "../services/scoreService";

const router: IRouter = Router();

const PHOTO_EVIDENCE_KEYS = new Set([
  "avatarUrl",
  "imageUrl",
  "profileImageUrl",
  "suspiciousProfileImageUrl",
  "stolenPhotoUrl",
  "yourPhotoUrl",
]);

function stripPhotoReferences(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPhotoReferences);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !PHOTO_EVIDENCE_KEYS.has(key))
      .map(([key, nested]) => [key, stripPhotoReferences(nested)]),
  );
}

export async function deletePhotoDerivedData(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  deletedAt: Date,
): Promise<void> {
  const threatEvidence = await tx
    .select({
      id: threatsTable.id,
      evidenceJson: threatsTable.evidenceJson,
      detectedSignalsJson: threatsTable.detectedSignalsJson,
    })
    .from(threatsTable)
    .where(eq(threatsTable.userId, userId));

  for (const threat of threatEvidence) {
    const scrubJson = (json: string | null): string | null => {
      if (!json) return json;
      try {
        return JSON.stringify(stripPhotoReferences(JSON.parse(json)));
      } catch {
        // Invalid legacy JSON cannot be proven free of retained image data.
        return null;
      }
    };
    await tx
      .update(threatsTable)
      .set({
        evidenceJson: scrubJson(threat.evidenceJson),
        detectedSignalsJson: scrubJson(threat.detectedSignalsJson),
        impersonatorDHash: null,
      })
      .where(eq(threatsTable.id, threat.id));
  }

  const connectedAccounts = await tx
    .select({ id: connectedAccountsTable.id })
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId));
  for (const account of connectedAccounts) {
    await tx.delete(mediaItemsTable).where(eq(mediaItemsTable.accountId, account.id));
  }

  await tx.delete(userPhotoHashesTable).where(eq(userPhotoHashesTable.userId, userId));
  await tx.delete(identityEmbeddingsTable).where(eq(identityEmbeddingsTable.userId, userId));
  await tx.delete(visualFingerprintsTable).where(eq(visualFingerprintsTable.userId, userId));
  await tx.delete(phashFeedbackTable).where(eq(phashFeedbackTable.userId, userId));
  await tx
    .update(userIdentityProfilesTable)
    .set({
      canonicalHashClusterJson: "[]",
      overallConfidence: 0,
      verifiedPlatformCount: 0,
      anchorHashCount: 0,
      confidenceTier: "UNVERIFIED",
      lastComputedAt: deletedAt,
    })
    .where(eq(userIdentityProfilesTable.userId, userId));
  await tx.update(usersTable).set({ avatarUrl: null, updatedAt: deletedAt }).where(eq(usersTable.id, userId));
}

router.get("/me", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const accounts = await db
      .select()
      .from(connectedAccountsTable)
      .where(eq(connectedAccountsTable.userId, userId));

    const fingerprint = await getFingerprintForUser(userId);

    const [lastScanJob] = await db
      .select({ completedAt: scanJobsTable.completedAt })
      .from(scanJobsTable)
      .where(eq(scanJobsTable.userId, userId))
      .orderBy(desc(scanJobsTable.startedAt))
      .limit(1);

    const lastScan = lastScanJob?.completedAt
      ? formatRelativeTime(lastScanJob.completedAt)
      : "Never";

    const fingerprintUpdated = fingerprint.lastUpdated
      ? formatRelativeTime(new Date(fingerprint.lastUpdated))
      : "Never";

    const sub = await getSubscription(userId);

    const freshScore = await recalculateScore(userId);

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      avatarInitials: user.avatarInitials,
      avatarUrl: user.avatarUrl ?? null,
      tier: sub.tier,
      securityScore: freshScore,
      scoreTrend: user.scoreTrend,
      monitored: accounts.length,
      onboardingCompleted: user.onboardingAnswers !== null,
      lastScan,
      nextScanDue: user.nextScanDue?.toISOString() ?? null,
      totalPhotosIndexed: fingerprint.totalPhotosIndexed,
      totalCaptionsIndexed: fingerprint.totalCaptionsIndexed,
      reelsIndexed: fingerprint.reelsIndexed,
      fingerprintUpdated,
      // Returned so the mobile client can skip the TermsUpdateModal when the
      // user's accepted version matches CURRENT_TERMS_VERSION — without this
      // field the client always fell back to showing the modal on cache miss.
      termsVersion: user.termsVersion ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "GET /me failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

const PatchMeBody = z.object({
  name: z.string().optional(),
  username: z.string().optional(),
  email: z.union([z.string(), z.null()]).optional(),
}).strict();

router.patch("/me", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const parsed = PatchMeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
      return;
    }
    const { name, username, email } = parsed.data;

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        res.status(400).json({ error: "Name cannot be empty" });
        return;
      }
      updates.name = trimmed;
      const initials = trimmed
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");
      updates.avatarInitials = initials;
    }

    if (username !== undefined) updates.username = username.trim();
    if (email !== undefined) updates.email = email === null ? null : email.trim() || null;

    await db
      .update(usersTable)
      .set(updates as Parameters<typeof db.update>[0] extends infer T ? any : never)
      .where(eq(usersTable.id, userId));

    const [updated] = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, username: usersTable.username, avatarInitials: usersTable.avatarInitials })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "PATCH /me failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/me/avatar", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const parsed = z.object({ imageBase64: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }
    const { imageBase64 } = parsed.data;

    const raw = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const compressed = await sharp(Buffer.from(raw, "base64"))
      .resize(160, 160, { fit: "cover", position: "centre" })
      .jpeg({ quality: 82 })
      .toBuffer();

    const avatarUrl = `data:image/jpeg;base64,${compressed.toString("base64")}`;

    await db
      .update(usersTable)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    res.json({ avatarUrl });
  } catch (err) {
    req.log.error({ err }, "PATCH /me/avatar failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/me", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const [user] = await db
      .select({ id: usersTable.id, clerkId: usersTable.clerkId })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const accounts = await db
      .select({
        platform: connectedAccountsTable.platform,
        accessToken: connectedAccountsTable.accessToken,
        platformUserId: connectedAccountsTable.platformUserId,
      })
      .from(connectedAccountsTable)
      .where(eq(connectedAccountsTable.userId, userId));

    await Promise.allSettled(
      accounts
        .filter((a) => a.accessToken)
        .map(async (account) => {
          const token = account.accessToken!;
          try {
            if (account.platform === "facebook" || account.platform === "instagram") {
              await fetch(
                `https://graph.facebook.com/v22.0/${account.platformUserId ?? "me"}/permissions?access_token=${token}`,
                { method: "DELETE" }
              );
            }
          } catch (err) {
            req.log.warn({ platform: account.platform, err }, "Token revocation failed (non-fatal)");
          }
        })
    );

    await db.delete(usersTable).where(eq(usersTable.id, userId));

    if (user.clerkId && process.env.CLERK_SECRET_KEY) {
      try {
        const resp = await fetch(`https://api.clerk.com/v1/users/${user.clerkId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        });
        if (!resp.ok && resp.status !== 404) {
          req.log.warn({ userId, clerkId: user.clerkId, status: resp.status }, "Clerk user deletion failed (non-fatal)");
        } else {
          req.log.info({ userId, clerkId: user.clerkId, status: resp.status }, "Clerk user deleted");
        }
      } catch (err) {
        req.log.warn({ userId, clerkId: user.clerkId, err }, "Clerk user deletion failed (non-fatal)");
      }
    }

    // Remove the subscriber from RevenueCat so they no longer appear in the
    // dashboard and their entitlements are fully revoked on RC's side.
    // The actual App Store / Play Store subscription must be cancelled by the
    // user through their store settings — neither RC nor our server can cancel
    // store-managed billing on their behalf.
    // Requires REVENUECAT_SECRET_KEY to be set (V2 secret from RC dashboard).
    if (user.clerkId && process.env.REVENUECAT_SECRET_KEY) {
      try {
        const rcResp = await fetch(
          `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.clerkId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${process.env.REVENUECAT_SECRET_KEY}` },
          }
        );
        if (rcResp.ok || rcResp.status === 404) {
          req.log.info({ userId, clerkId: user.clerkId }, "RevenueCat subscriber deleted");
        } else {
          req.log.warn({ userId, clerkId: user.clerkId, status: rcResp.status }, "RevenueCat subscriber deletion failed (non-fatal)");
        }
      } catch (err) {
        req.log.warn({ userId, clerkId: user.clerkId, err }, "RevenueCat subscriber deletion failed (non-fatal)");
      }
    }

    req.log.info({ userId }, "User account deleted");
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "DELETE /me failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /me/terms ──────────────────────────────────────────────────────────
// Records that the authenticated user has explicitly accepted the current
// Terms of Service and Privacy Policy (version-stamped for audit purposes).
const TermsAcceptanceBody = z.object({
  termsVersion: z.string().min(1).max(32),
}).strict();

router.post("/me/terms", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const parsed = TermsAcceptanceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
      return;
    }
    const now = new Date();
    await db
      .update(usersTable)
      .set({ termsAcceptedAt: now, termsVersion: parsed.data.termsVersion, updatedAt: now })
      .where(eq(usersTable.id, userId));
    req.log.info({ userId, termsVersion: parsed.data.termsVersion }, "Terms accepted");
    res.json({ ok: true, acceptedAt: now.toISOString() });
  } catch (err) {
    req.log.error({ err }, "POST /me/terms failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Age confirmation ────────────────────────────────────────────────────────
const AgeConfirmBody = z.object({
  ageVersion: z.string().min(1).max(20),
}).strict();

router.post("/me/age-confirm", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const parsed = AgeConfirmBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
      return;
    }
    const now = new Date();
    await db
      .update(usersTable)
      .set({ ageConfirmedAt: now, minimumAgeVersion: parsed.data.ageVersion, updatedAt: now })
      .where(eq(usersTable.id, userId));
    req.log.info({ userId, ageVersion: parsed.data.ageVersion }, "Age confirmation recorded");
    res.json({ ok: true, confirmedAt: now.toISOString() });
  } catch (err) {
    req.log.error({ err }, "POST /me/age-confirm failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Photo Processing Consent ────────────────────────────────────────────────
export const CURRENT_PHOTO_CONSENT_VERSION = "2026-09-15-v4";

const PhotoConsentBody = z.object({
  consentVersion: z.literal(CURRENT_PHOTO_CONSENT_VERSION).default(CURRENT_PHOTO_CONSENT_VERSION),
}).strict();

/** GET /me/photo-consent — returns current consent status */
router.get("/me/photo-consent", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const [consent] = await db
      .select()
      .from(photoProcessingConsentsTable)
      .where(
        and(
          eq(photoProcessingConsentsTable.userId, userId),
          isNull(photoProcessingConsentsTable.withdrawnAt),
          eq(photoProcessingConsentsTable.consentVersion, CURRENT_PHOTO_CONSENT_VERSION)
        )
      )
      .limit(1);
    res.json({
      hasConsent: Boolean(consent),
      consentedAt: consent?.consentedAt?.toISOString() ?? null,
      consentVersion: consent?.consentVersion ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "GET /me/photo-consent failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /me/photo-consent — grant consent */
router.post("/me/photo-consent", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const parsed = PhotoConsentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
      return;
    }
    // Mark any existing active consent as withdrawn first (idempotent re-consent)
    const now = new Date();
    await db
      .update(photoProcessingConsentsTable)
      .set({ withdrawnAt: now })
      .where(
        and(
          eq(photoProcessingConsentsTable.userId, userId),
          isNull(photoProcessingConsentsTable.withdrawnAt)
        )
      );
    // Insert fresh consent record
    const [row] = await db
      .insert(photoProcessingConsentsTable)
      .values({
        userId,
        consentVersion: parsed.data.consentVersion,
        consentedAt: now,
      })
      .returning();
    req.log.info({ userId, consentVersion: parsed.data.consentVersion }, "Photo processing consent recorded");
    res.json({ ok: true, consentedAt: row?.consentedAt?.toISOString() ?? now.toISOString() });
  } catch (err) {
    req.log.error({ err }, "POST /me/photo-consent failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /me/photo-consent — withdraw consent; triggers data deletion */
router.delete("/me/photo-consent", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const now = new Date();
    await db
      .update(photoProcessingConsentsTable)
      .set({ withdrawnAt: now })
      .where(
        and(
          eq(photoProcessingConsentsTable.userId, userId),
          isNull(photoProcessingConsentsTable.withdrawnAt)
        )
      );
    // Delete every locally stored photo-derived record and the reconstructable
    // avatar in one transaction. This also removes source URLs held alongside
    // the dHash rows.
    await db.transaction(async (tx) => {
      await deletePhotoDerivedData(tx, userId, now);
    });
    req.log.info({ userId }, "Photo processing consent withdrawn + photo data deleted");
    res.json({ ok: true, withdrawnAt: now.toISOString() });
  } catch (err) {
    req.log.error({ err }, "DELETE /me/photo-consent failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /me/photo-data — delete all photo-derived data without withdrawing consent */
router.delete("/me/photo-data", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const deletedAt = new Date();
    await db.transaction(async (tx) => {
      await deletePhotoDerivedData(tx, userId, deletedAt);
    });
    req.log.info({ userId }, "Photo-derived data deleted on user request");
    res.json({ ok: true, deletedAt: deletedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "DELETE /me/photo-data failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /me/export — GDPR Art. 20 data portability export */
router.get("/me/export", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const accounts = await db.select().from(connectedAccountsTable).where(eq(connectedAccountsTable.userId, userId));
    const consentRows = await db.select().from(photoProcessingConsentsTable).where(eq(photoProcessingConsentsTable.userId, userId));
    const scanJobs = await db
      .select({
        id: scanJobsTable.id,
        status: scanJobsTable.status,
        startedAt: scanJobsTable.startedAt,
        completedAt: scanJobsTable.completedAt,
        threatsFound: scanJobsTable.threatsFound,
      })
      .from(scanJobsTable)
      .where(eq(scanJobsTable.userId, userId));
    const threats = await db
      .select({
        id: threatsTable.id,
        platform: threatsTable.platform,
        detectedAt: threatsTable.createdAt,
        resolvedAt: threatsTable.resolvedAt,
        severity: threatsTable.severity,
        resolved: threatsTable.resolved,
        suspiciousUsername: threatsTable.suspiciousUsername,
      })
      .from(threatsTable)
      .where(eq(threatsTable.userId, userId));
    const photoHashes = await db
      .select({
        platformMediaId: userPhotoHashesTable.platformMediaId,
        accountId: userPhotoHashesTable.accountId,
        dHash: userPhotoHashesTable.dHash,
        embeddingJson: userPhotoHashesTable.embeddingJson,
        sourceUrl: userPhotoHashesTable.sourceUrl,
        publishedAt: userPhotoHashesTable.publishedAt,
      })
      .from(userPhotoHashesTable)
      .where(eq(userPhotoHashesTable.userId, userId));
    const identityEmbeddings = await db
      .select({
        imageUrl: identityEmbeddingsTable.imageUrl,
        embeddingJson: identityEmbeddingsTable.embeddingJson,
        createdAt: identityEmbeddingsTable.createdAt,
        updatedAt: identityEmbeddingsTable.updatedAt,
      })
      .from(identityEmbeddingsTable)
      .where(eq(identityEmbeddingsTable.userId, userId));
    const visualFingerprint = await db
      .select()
      .from(visualFingerprintsTable)
      .where(eq(visualFingerprintsTable.userId, userId));

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      service: "Rook Identity Labs LLC",
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        createdAt: user.createdAt,
        termsAcceptedAt: user.termsAcceptedAt,
        termsVersion: user.termsVersion,
        ageConfirmedAt: user.ageConfirmedAt,
        minimumAgeVersion: user.minimumAgeVersion,
        securityScore: user.securityScore,
        scanCount: user.scanCount,
        avatarUrl: user.avatarUrl,
      },
      connectedAccounts: accounts.map((a) => ({
        platform: a.platform,
        username: a.username,
        connectedAt: a.createdAt,
        // Never include token in export
      })),
      photoProcessingConsents: consentRows.map((c) => ({
        consentVersion: c.consentVersion,
        consentedAt: c.consentedAt,
        withdrawnAt: c.withdrawnAt,
      })),
      scanHistory: scanJobs,
      threats,
      photoData: {
        hashes: photoHashes,
        identityEmbeddings,
        visualFingerprint: visualFingerprint[0] ?? null,
      },
    };

    res.setHeader("Content-Disposition", 'attachment; filename="rook-data-export.json"');
    res.setHeader("Content-Type", "application/json");
    res.json(exportPayload);
    req.log.info({ userId }, "Data export served (GDPR Art. 20)");
  } catch (err) {
    req.log.error({ err }, "GET /me/export failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

const OnboardingAnswersBody = z.object({
  answers: z.record(z.unknown()),
}).strict();

router.post("/me/onboarding", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const parsed = OnboardingAnswersBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
      return;
    }
    await db
      .update(usersTable)
      .set({ onboardingAnswers: parsed.data.answers, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "POST /me/onboarding failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default router;
