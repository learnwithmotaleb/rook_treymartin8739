import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

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

const SCAM_SYSTEM_PROMPT = `You are ShieldID's AI scam detection engine. Your role is to analyze text messages, social media posts, emails, or any other communications for signs of scams, phishing, fraud, or impersonation attempts.

Analyze the provided text and return a JSON object with this exact structure:
{
  "riskScore": <integer 0-100>,
  "riskLevel": "<low|medium|high>",
  "detectedPatterns": [<array of detected scam pattern strings>],
  "explanation": "<clear explanation of why this is or isn't a scam>",
  "recommendation": "<actionable recommendation for the user>"
}

Risk score guidelines:
- 0-30: Low risk — likely legitimate
- 31-65: Medium risk — suspicious elements present
- 66-100: High risk — strong scam indicators

Common scam patterns to detect:
- Urgency/pressure tactics ("Act now", "Limited time", "Expires today")
- Cryptocurrency requests or wire transfer requests
- Fake prize/giveaway claims
- Impersonation of brands or public figures
- Phishing links or requests for personal info
- Too-good-to-be-true offers
- Unusual payment method requests
- Threats or fear tactics
- Poor grammar/spelling (common in mass scam campaigns)
- Requests to "verify" account information
- Fake invoice/delivery notifications
- Romance scam patterns

Return ONLY the JSON object, no other text.`;

const EXPLANATION_SYSTEM_PROMPT = `You are ShieldID's AI identity investigator. Generate a clear, concise explanation for why an account was flagged as a potential impersonator. 

Write 2-3 sentences maximum. Be specific about the evidence. Use confident but factual language.
The explanation should feel like it was written by a professional digital forensics analyst.

Return ONLY the explanation text, nothing else.`;

export async function analyzeScamText(
  text: string
): Promise<ScamAnalysisResult> {
  logger.info({ textLength: text.length }, "Analyzing text for scam patterns");

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: SCAM_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze this text for scam patterns:\n\n${text}`,
      },
    ],
  });

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
      detectedPatterns: Array.isArray(parsed.detectedPatterns)
        ? parsed.detectedPatterns
        : [],
      explanation:
        parsed.explanation || "Unable to generate explanation at this time.",
      recommendation:
        parsed.recommendation || "Exercise caution with this content.",
      analyzedAt: new Date().toISOString(),
    };
  } catch {
    logger.warn({ content }, "Failed to parse AI scam analysis response");
    return {
      riskScore: 50,
      riskLevel: "medium",
      detectedPatterns: ["Analysis parsing error"],
      explanation:
        "AI analysis completed but the response format was unexpected.",
      recommendation:
        "Review this content carefully before taking any action.",
      analyzedAt: new Date().toISOString(),
    };
  }
}

export async function generateThreatExplanation(
  input: ThreatExplanationInput
): Promise<string> {
  logger.info(
    { threatType: input.threatType, platform: input.platform },
    "Generating threat explanation"
  );

  const prompt = [
    `Threat type: ${input.threatType}`,
    input.platform ? `Platform: ${input.platform}` : null,
    input.suspiciousUsername
      ? `Suspicious account: ${input.suspiciousUsername}`
      : null,
    `Matched media count: ${input.matchedMediaCount}`,
    `Detected signals: ${input.signals.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 256,
    messages: [
      { role: "system", content: EXPLANATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Generate an explanation for this threat:\n\n${prompt}`,
      },
    ],
  });

  return (
    response.choices[0]?.message?.content?.trim() ??
    "This account was flagged based on suspicious activity detected by ShieldID's AI monitoring system."
  );
}
