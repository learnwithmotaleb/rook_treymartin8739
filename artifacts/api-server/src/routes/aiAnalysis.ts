import { Router, type IRouter } from "express";
import { z } from "zod";
import { analyzeScamText, generateThreatExplanation } from "../services/aiAnalysisService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const AnalyzeScamBody = z.object({
  text: z.string().min(1, "text must not be empty").max(5000, "text must be 5000 characters or fewer"),
});

const GenerateExplanationBody = z.object({
  threatType: z.string().min(1),
  signals: z.array(z.string()),
  matchedMediaCount: z.number().int().min(0).optional(),
  platform: z.string().optional(),
  suspiciousUsername: z.string().optional(),
});

router.post("/ai/analyze-scam", async (req, res): Promise<void> => {
  const parsed = AnalyzeScamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  req.log.info({ textLength: parsed.data.text.length }, "Scam analysis requested");

  try {
    const result = await analyzeScamText(parsed.data.text.trim());
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Scam analysis failed");
    res.status(500).json({ error: "analysis_failed", message: "Unable to analyze text. Please try again." });
  }
});

router.post("/ai/generate-explanation", async (req, res): Promise<void> => {
  const parsed = GenerateExplanationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }
  const { threatType, signals, matchedMediaCount, platform, suspiciousUsername } = parsed.data;

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
  } catch (err) {
    req.log.error({ err }, "Threat explanation generation failed");
    res.status(500).json({ error: "generation_failed", message: "Unable to generate explanation. Please try again." });
  }
});

export default router;
