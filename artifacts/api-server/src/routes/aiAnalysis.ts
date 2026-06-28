import { Router, type IRouter } from "express";
import { analyzeScamText, generateThreatExplanation } from "../services/aiAnalysisService";

import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/ai/analyze-scam", async (req, res): Promise<void> => {
  const { text } = req.body as { text?: string };

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text is required and must be a non-empty string" });
    return;
  }

  if (text.length > 5000) {
    res.status(400).json({ error: "text must be 5000 characters or fewer" });
    return;
  }

  req.log.info({ textLength: text.length }, "Scam analysis requested");

  try {
    const result = await analyzeScamText(text.trim());
    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "Scam analysis failed");
    res.status(500).json({ error: "analysis_failed", message: "Unable to analyze text. Please try again." });
  }
});

router.post("/ai/generate-explanation", async (req, res): Promise<void> => {
  const { threatType, signals, matchedMediaCount, platform, suspiciousUsername } =
    req.body as {
      threatType?: string;
      signals?: string[];
      matchedMediaCount?: number;
      platform?: string;
      suspiciousUsername?: string;
    };

  if (!threatType || typeof threatType !== "string") {
    res.status(400).json({ error: "threatType is required" });
    return;
  }

  if (!Array.isArray(signals)) {
    res.status(400).json({ error: "signals must be an array of strings" });
    return;
  }

  req.log.info({ threatType, platform }, "Threat explanation requested");

  try {
    const explanation = await generateThreatExplanation({
      threatType,
      signals,
      matchedMediaCount: matchedMediaCount ?? 0,
      platform: platform ?? null,
      suspiciousUsername: suspiciousUsername ?? null,
    });

    res.json({
      explanation,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    req.log.error({ err }, "Threat explanation generation failed");
    res.status(500).json({ error: "generation_failed", message: "Unable to generate explanation. Please try again." });
  }
});

export default router;
