import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, connectedAccountsTable, threatsTable, suppressedAccountsTable } from "@workspace/db";
import {
  reverseImageSearchForPhoto,
  isVisionConfigured,
} from "../services/webSearchService";
import { logger } from "../lib/logger";
import { recalculateScore } from "../services/scoreService";
import { buildSuppressKey, normalizeSuppressUsername } from "../services/scanOrchestrator";
import { isSafeUrl } from "../lib/ssrf";

const router: IRouter = Router();

const MAX_BASE64_BYTES = 8 * 1024 * 1024; // 8 MB limit

/**
 * POST /photos/search
 * Accepts a public image URL (from a connected account CDN) or a base64-encoded
 * image (from the device camera roll). Runs Google Cloud Vision WEB_DETECTION
 * and creates real threat records for any confirmed matches on external profiles.
 */
router.post("/photos/search", async (req, res): Promise<void> => {
  const userId = req.userId;

  const parsedBody = z.object({
    imageUrl: z.string().url().optional(),
    imageBase64: z.string().optional(),
    localUri: z.string().optional(),
  }).safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { imageUrl, imageBase64, localUri } = parsedBody.data;

  if (!imageUrl && !imageBase64) {
    res.status(400).json({ error: "imageUrl or imageBase64 is required" });
    return;
  }

  // SSRF guard: reject user-supplied URLs that target private/internal networks
  if (imageUrl && !isSafeUrl(imageUrl)) {
    res.status(400).json({ error: "The supplied image URL is not accessible." });
    return;
  }

  if (imageBase64 && Buffer.byteLength(imageBase64, "base64") > MAX_BASE64_BYTES) {
    res.status(413).json({ error: "Image too large. Please use a smaller photo." });
    return;
  }

  if (!isVisionConfigured()) {
    res.json({ matches: [], threatsCreated: 0, configured: false });
    return;
  }

  try {
    const { matches } = await reverseImageSearchForPhoto({ imageUrl, imageBase64 });

    // Filter out the user's own connected accounts from results
    const ownAccounts = await db
      .select({
        platform: connectedAccountsTable.platform,
        username: connectedAccountsTable.username,
      })
      .from(connectedAccountsTable)
      .where(eq(connectedAccountsTable.userId, userId));

    const ownKeys = new Set(
      ownAccounts.map(
        (a) => `${a.platform}:${a.username.toLowerCase().replace(/^@/, "")}`
      )
    );

    const externalMatches = matches.filter(
      (m) => !ownKeys.has(`${m.platform}:${m.username.toLowerCase()}`)
    );

    // Load suppression set — never re-create threats for accounts the user already resolved
    const suppressedRows = await db
      .select({ platform: suppressedAccountsTable.platform, username: suppressedAccountsTable.username })
      .from(suppressedAccountsTable)
      .where(eq(suppressedAccountsTable.userId, userId));
    const suppressionSet = new Set(suppressedRows.map((r) => buildSuppressKey(r.platform, r.username)));

    const unsuppressedMatches = externalMatches.filter(
      (m) => !suppressionSet.has(buildSuppressKey(m.platform, normalizeSuppressUsername(m.username)))
    );

    if (externalMatches.length !== unsuppressedMatches.length) {
      logger.info(
        { suppressed: externalMatches.length - unsuppressedMatches.length, total: externalMatches.length },
        "Photo search: skipped suppressed accounts"
      );
    }

    let threatsCreated = 0;

    for (const match of unsuppressedMatches) {
      try {
        const simPct = Math.round(match.similarity * 100);
        const platformLabel = match.platform.charAt(0).toUpperCase() + match.platform.slice(1);

        // stolenPhotoUrl: actual image URL for display (nested from Vision page data
        // or the CDN image URL itself). May require auth on some platforms — the
        // client falls back to "Tap to view" gracefully when it can't render.
        const stolenPhotoUrl = match.imageUrl ?? match.profileUrl;

        // stolenPageUrl: the web page where the image was found — used as the
        // tap target to open the platform page directly in the browser.
        const stolenPageUrl = match.profileUrl;

        // yourPhotoUrl: CDN URL for account photos; for camera roll uploads use the
        // base64 as a data URI so it persists in the DB and renders in any session
        // without depending on the device's ephemeral temp file path.
        const yourPhotoUrl = imageUrl
          ?? (imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : undefined)
          ?? localUri
          ?? undefined;

        await db.insert(threatsTable).values({
          userId,
          type: "stolen_photo",
          severity: "high",
          platform: match.platform,
          title: "Possible photo match",
          description: `Your photo appears to match content on @${match.username}'s ${platformLabel} profile.`,
          details: `Visual match found on: ${match.profileUrl}`,
          aiExplanation:
            `Your uploaded photo appears to match content on @${match.username}'s ${platformLabel} account ` +
            `(${simPct}% visual similarity). ` +
            `This suggests your image may be in use on another account without your authorization. ` +
            `We recommend reviewing @${match.username}'s profile and reporting it to ${platformLabel} using the Report button below.`,
          threatScore: simPct,
          suspiciousUsername: match.username,
          matchedMediaCount: 1,
          evidenceJson: JSON.stringify([
            {
              id: `ev_search_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: "post_photo",
              similarity: simPct,
              label: "Possible photo match",
              ...(yourPhotoUrl ? { yourPhotoUrl } : {}),
              stolenPhotoUrl,
              stolenPageUrl,
            },
          ]),
          scoreBreakdownJson: JSON.stringify({
            mediaSimilarity: Math.round(match.similarity * 40),
            contentReuse: 20,
            profileSimilarity: 0,
            bioSimilarity: 0,
            usernameSimilarity: 0,
            behavioral: 0,
          }),
          detectedSignalsJson: JSON.stringify([
            `Visual media similarity confirmed (${Math.round(match.similarity * 40)}/40 match score)`,
            "Visual photo match identified on external profile",
            "Possible unauthorized photo use detected",
          ]),
          resolved: false,
        });
        threatsCreated++;
      } catch (err) {
        logger.error({ err, match }, "Failed to insert photo threat record");
      }
    }

    if (threatsCreated > 0) {
      recalculateScore(userId).catch((err) =>
        logger.warn({ err }, "Score recalculation failed after photo threats")
      );
    }

    logger.info(
      { userId, matchesFound: externalMatches.length, threatsCreated },
      "Photo reverse search complete"
    );

    res.json({ matches: externalMatches, threatsCreated, configured: true });
  } catch (err) {
    logger.error({ err }, "Reverse image search failed");
    res.status(500).json({ error: "Search failed. Please try again." });
  }
});

export default router;
