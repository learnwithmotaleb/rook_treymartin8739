/**
 * AI Analysis Service
 *
 * Cost optimizations applied:
 * - Threat explanations use gpt-4o-mini (99% cheaper than gpt-5.1, same quality for 2-3 sentences)
 * - In-memory dedup cache: identical threat inputs reuse the same explanation for 1 hour
 * - Pending-request dedup: concurrent identical requests share one in-flight API call
 * - Scam analysis retains gpt-5.1 — it is user-facing and quality matters
 * - Response tokens are tightly capped per operation type
 */

import crypto from "crypto";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import { trackApiCall } from "./costTracker";

export interface ScamAnalysisResult {
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  detectedPatterns: string[];
  explanation: string;
  recommendation: string;
  analyzedAt: string;
}

export interface ThreatExplanationInput {
  threatType: string;
  signals: string[];
  matchedMediaCount: number;
  platform?: string | null;
  suspiciousUsername?: string | null;
}

// ─── System prompts ───────────────────────────────────────────────────────────

const SCAM_SYSTEM_PROMPT = `You are Rook's AI scam detection engine. Analyze text for scam indicators.

Return ONLY this JSON (no extra text):
{
  "riskScore": <0-100>,
  "riskLevel": "<low|medium|high>",
  "detectedPatterns": ["<pattern>"],
  "explanation": "<2 sentences>",
  "recommendation": "<1 actionable sentence>"
}

Risk: 0-30=low, 31-65=medium, 66-100=high.
Patterns: urgency, crypto requests, fake prizes, phishing, brand impersonation, too-good-to-be-true, unusual payment, threats, account verification, romance scam.`;

const EXPLANATION_SYSTEM_PROMPT = `You are Rook's identity investigator. Write 2 sentences explaining why an account was flagged as a potential impersonator. Be specific, factual, professional. Return only the explanation text.`;

// ─── In-memory explanation dedup cache ───────────────────────────────────────

interface CacheEntry {
  result: string;
  expires: number;
}

const explanationCache = new Map<string, CacheEntry>();
const pendingExplanations = new Map<string, Promise<string>>();
const EXPLANATION_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function makeExplanationKey(input: ThreatExplanationInput): string {
  const canonical = JSON.stringify({
    type: input.threatType,
    platform: input.platform ?? null,
    username: input.suspiciousUsername ?? null,
    media: input.matchedMediaCount,
    signals: [...input.signals].sort(),
  });
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

/** Prune expired entries — called before each cache read. */
function pruneExplanationCache(): void {
  if (explanationCache.size < 100) return;
  const now = Date.now();
  for (const [key, entry] of explanationCache.entries()) {
    if (entry.expires < now) explanationCache.delete(key);
  }
}

// ─── Scam analysis ───────────────────────────────────────────────────────────

export async function analyzeScamText(
  text: string,
  userId?: string
): Promise<ScamAnalysisResult> {
  logger.info({ textLength: text.length }, "Analyzing text for scam patterns");

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 512,
    messages: [
      { role: "system", content: SCAM_SYSTEM_PROMPT },
      { role: "user", content: `Analyze for scams:\n\n${text.slice(0, 2000)}` },
    ],
  });

  if (userId) {
    trackApiCall({
      userId,
      provider: "openai",
      operation: "scam_analysis",
      tokensUsed: response.usage?.total_tokens ?? 0,
    });
  }

  const content = response.choices[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(content) as {
      riskScore: number;
      riskLevel: string;
      detectedPatterns: string[];
      explanation: string;
      recommendation: string;
    };
    return {
      riskScore: Math.min(100, Math.max(0, Math.round(parsed.riskScore))),
      riskLevel: (["low", "medium", "high"].includes(parsed.riskLevel)
        ? parsed.riskLevel
        : "medium") as "low" | "medium" | "high",
      detectedPatterns: Array.isArray(parsed.detectedPatterns) ? parsed.detectedPatterns : [],
      explanation: parsed.explanation || "Unable to generate explanation at this time.",
      recommendation: parsed.recommendation || "Exercise caution with this content.",
      analyzedAt: new Date().toISOString(),
    };
  } catch {
    logger.warn({ content }, "Failed to parse AI scam analysis response");
    return {
      riskScore: 50,
      riskLevel: "medium",
      detectedPatterns: ["Analysis parsing error"],
      explanation: "AI analysis completed but the response format was unexpected.",
      recommendation: "Review this content carefully before taking any action.",
      analyzedAt: new Date().toISOString(),
    };
  }
}

// ─── Threat explanation ───────────────────────────────────────────────────────

export async function generateThreatExplanation(
  input: ThreatExplanationInput,
  userId?: string
): Promise<string> {
  const cacheKey = makeExplanationKey(input);
  pruneExplanationCache();

  // 1. Check in-memory cache
  const cached = explanationCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    logger.info({ cacheKey: cacheKey.slice(0, 12) }, "Explanation cache HIT");
    if (userId) {
      trackApiCall({ userId, provider: "openai", operation: "explanation", cacheHit: true });
    }
    return cached.result;
  }

  // 2. Dedup concurrent identical requests
  const existing = pendingExplanations.get(cacheKey);
  if (existing) {
    logger.info({ cacheKey: cacheKey.slice(0, 12) }, "Deduping in-flight explanation request");
    return existing;
  }

  const promise = _callExplanationApi(input, cacheKey, userId);
  pendingExplanations.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    pendingExplanations.delete(cacheKey);
  }
}

async function _callExplanationApi(
  input: ThreatExplanationInput,
  cacheKey: string,
  userId?: string
): Promise<string> {
  logger.info(
    { threatType: input.threatType, platform: input.platform },
    "Generating threat explanation via gpt-4o-mini"
  );

  // Compact prompt — only include populated fields
  const lines: string[] = [`Type: ${input.threatType}`];
  if (input.platform) lines.push(`Platform: ${input.platform}`);
  if (input.suspiciousUsername) lines.push(`Account: ${input.suspiciousUsername}`);
  if (input.matchedMediaCount > 0) lines.push(`Matched media: ${input.matchedMediaCount}`);
  // Keep top 5 signals to stay under token budget
  lines.push(`Signals: ${input.signals.slice(0, 5).join("; ")}`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 120, // 2 sentences max
    messages: [
      { role: "system", content: EXPLANATION_SYSTEM_PROMPT },
      { role: "user", content: lines.join("\n") },
    ],
  });

  const result =
    response.choices[0]?.message?.content?.trim() ??
    "This account was flagged based on suspicious activity detected by Rook's AI monitoring system.";

  // Store in cache
  explanationCache.set(cacheKey, {
    result,
    expires: Date.now() + EXPLANATION_CACHE_TTL_MS,
  });

  if (userId) {
    trackApiCall({
      userId,
      provider: "openai",
      operation: "explanation",
      tokensUsed: response.usage?.total_tokens ?? 0,
    });
  }

  return result;
}
