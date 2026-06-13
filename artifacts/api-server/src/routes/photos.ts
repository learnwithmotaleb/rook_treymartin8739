import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, connectedAccountsTable, threatsTable } from "@workspace/db";
import {
  reverseImageSearchForPhoto,
  isVisionConfigured,
} from "../services/webSearchService";
import { logger } from "../lib/logger";

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
  const { imageUrl, imageBase64 } = req.body as {
    imageUrl?: string;
    imageBase64?: string;
  };

  if (!imageUrl && !imageBase64) {
    res.status(400).json({ error: "imageUrl or imageBase64 is required" });
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

    let threatsCreated = 0;

    for (const match of externalMatches) {
      try {
        const simPct = Math.round(match.similarity * 100);
        const platformLabel = match.platform.charAt(0).toUpperCase() + match.platform.slice(1);

        // stolenPhotoUrl: for fullMatchingImages candidates Vision returns the CDN
        // image URL as profileUrl — it renders directly. For page-match candidates
        // profileUrl is a page URL which Image will reject and fall back gracefully.
        const stolenPhotoUrl = match.profileUrl;

        // yourPhotoUrl: when the caller gave us a CDN imageUrl to search, pass it
        // through so the "Your Photo" side of the evidence card can render.
        const yourPhotoUrl = imageUrl ?? undefined;

        await db.insert(threatsTable).values({
          userId,
          type: "stolen_photo",
          severity: "high",
          platform: match.platform,
          title: "Stolen photo detected",
          description: `Your photo was found on @${match.username}'s ${platformLabel} profile via reverse image search.`,
          details: `Discovered via Google Vision WEB_DETECTION API. Confirmed on: ${match.profileUrl}`,
          aiExplanation:
            `Your uploaded photo was confirmed on @${match.username}'s ${platformLabel} account ` +
            `through Google's reverse image search (WEB_DETECTION API with ${simPct}% confidence). ` +
            `This means your image is actively being used without your authorization on another account's profile. ` +
            `We recommend reporting @${match.username} to ${platformLabel} using the Report button below.`,
          threatScore: simPct,
          suspiciousUsername: match.username,
          matchedMediaCount: 1,
          evidenceJson: JSON.stringify([
            {
              id: `ev_search_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: "post_photo",
              similarity: simPct,
              label: "Photo confirmed via Google reverse image search",
              ...(yourPhotoUrl ? { yourPhotoUrl } : {}),
              stolenPhotoUrl,
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
            "Reverse image search confirmed photo match",
            "Unauthorized photo use detected on external profile",
          ]),
          resolved: false,
        });
        threatsCreated++;
      } catch (err) {
        logger.error({ err, match }, "Failed to insert photo threat record");
      }
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
