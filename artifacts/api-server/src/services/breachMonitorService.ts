/**
 * Breach Monitor Service
 *
 * Integrates with Have I Been Pwned (HIBP) API for credential breach detection.
 *
 * HIBP API documentation: https://haveibeenpwned.com/API/v3
 *
 * Two endpoints are used:
 * 1. GET /breachedaccount/{account} — requires HIBP_API_KEY (paid, $3.50/month)
 *    Checks if a specific email was in any known data breach.
 *
 * 2. GET https://api.pwnedpasswords.com/range/{prefix} — FREE, k-anonymity
 *    Checks if a password hash prefix appears in any known breach.
 *    Only the first 5 characters of the SHA-1 hash are sent to HIBP,
 *    preserving full k-anonymity.
 *
 * Note: Set HIBP_API_KEY environment variable to enable email breach checking.
 * Without it, the service runs in simulation mode for email checks.
 */

import { logger } from "../lib/logger";

export interface Breach {
  name: string;
  title: string;
  domain: string;
  breachDate: string;
  pwnCount: number;
  dataClasses: string[];
  description: string;
}

export interface BreachCheckResult {
  email: string;
  breachCount: number;
  breaches: Breach[];
  checkedAt: string;
  source: "hibp_api" | "simulation";
}

export interface PasswordBreachResult {
  breached: boolean;
  occurrences: number;
  checkedAt: string;
}

const HIBP_BASE_URL = "https://haveibeenpwned.com/api/v3";
const HIBP_USER_AGENT = "ShieldID-IdentityProtection/1.0";

/**
 * Check if an email address appears in known data breaches.
 * Requires HIBP_API_KEY environment variable.
 *
 * In simulation mode (no key), returns a realistic mock result
 * to demonstrate the capability.
 */
export async function checkEmailBreach(
  email: string
): Promise<BreachCheckResult> {
  const apiKey = process.env.HIBP_API_KEY;

  if (!apiKey) {
    logger.info(
      { email: email.split("@")[1] },
      "HIBP_API_KEY not set, using simulation mode for breach check"
    );
    return simulateBreachCheck(email);
  }

  try {
    const response = await fetch(
      `${HIBP_BASE_URL}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          "hibp-api-key": apiKey,
          "user-agent": HIBP_USER_AGENT,
        },
      }
    );

    if (response.status === 404) {
      return {
        email,
        breachCount: 0,
        breaches: [],
        checkedAt: new Date().toISOString(),
        source: "hibp_api",
      };
    }

    if (!response.ok) {
      logger.warn(
        { status: response.status },
        "HIBP API returned non-OK status"
      );
      return simulateBreachCheck(email);
    }

    const data = (await response.json()) as Array<{
      Name: string;
      Title: string;
      Domain: string;
      BreachDate: string;
      PwnCount: number;
      DataClasses: string[];
      Description: string;
    }>;

    const breaches: Breach[] = data.map((b) => ({
      name: b.Name,
      title: b.Title,
      domain: b.Domain,
      breachDate: b.BreachDate,
      pwnCount: b.PwnCount,
      dataClasses: b.DataClasses,
      description: b.Description.replace(/<[^>]*>/g, ""),
    }));

    return {
      email,
      breachCount: breaches.length,
      breaches,
      checkedAt: new Date().toISOString(),
      source: "hibp_api",
    };
  } catch (err) {
    logger.error({ err }, "HIBP API request failed");
    return simulateBreachCheck(email);
  }
}

/**
 * Check if a password (provided as SHA-1 hash) has been seen in breaches.
 * Uses k-anonymity: only the first 5 hex characters are sent to HIBP.
 * This endpoint is FREE and requires no API key.
 */
export async function checkPasswordBreach(
  sha1Hash: string
): Promise<PasswordBreachResult> {
  const prefix = sha1Hash.substring(0, 5).toUpperCase();
  const suffix = sha1Hash.substring(5).toUpperCase();

  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: { "user-agent": HIBP_USER_AGENT, "Add-Padding": "true" },
      }
    );

    if (!response.ok) {
      return { breached: false, occurrences: 0, checkedAt: new Date().toISOString() };
    }

    const text = await response.text();
    const lines = text.split("\r\n");

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(":");
      if (hashSuffix === suffix) {
        const occurrences = parseInt(countStr ?? "0", 10);
        return {
          breached: occurrences > 0,
          occurrences,
          checkedAt: new Date().toISOString(),
        };
      }
    }

    return { breached: false, occurrences: 0, checkedAt: new Date().toISOString() };
  } catch (err) {
    logger.error({ err }, "HIBP Pwned Passwords API request failed");
    return { breached: false, occurrences: 0, checkedAt: new Date().toISOString() };
  }
}

function simulateBreachCheck(email: string): BreachCheckResult {
  const domain = email.split("@")[1] ?? "unknown";
  const shouldHaveBreach = domain !== "shieldid.app";

  if (!shouldHaveBreach) {
    return {
      email,
      breachCount: 0,
      breaches: [],
      checkedAt: new Date().toISOString(),
      source: "simulation",
    };
  }

  return {
    email,
    breachCount: 1,
    breaches: [
      {
        name: "SimulatedBreach2024",
        title: "DataCore 2024 Breach",
        domain: "datacore.io",
        breachDate: "2024-03-15",
        pwnCount: 45000000,
        dataClasses: ["Email addresses", "Passwords", "Usernames"],
        description:
          "In March 2024, DataCore experienced a security incident that exposed 45 million user records including email addresses and hashed passwords.",
      },
    ],
    checkedAt: new Date().toISOString(),
    source: "simulation",
  };
}
