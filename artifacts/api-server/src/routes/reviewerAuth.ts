import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const reviewerAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many review access attempts. Please wait and try again." },
});

function secureStringEqual(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

type ClerkReviewer = {
  id: string;
  email_addresses?: Array<{ email_address?: string }>;
  private_metadata?: Record<string, unknown>;
};

async function clerkRequest(
  path: string,
  clerkSecretKey: string,
  init?: RequestInit,
): Promise<globalThis.Response> {
  return fetch(`https://api.clerk.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${clerkSecretKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function resolveReviewer(
  configuredReviewerId: string,
  clerkSecretKey: string,
): Promise<ClerkReviewer> {
  const configuredResponse = await clerkRequest(
    `/v1/users/${encodeURIComponent(configuredReviewerId)}`,
    clerkSecretKey,
  );
  if (configuredResponse.ok) {
    return (await configuredResponse.json()) as ClerkReviewer;
  }
  // Never use an untrusted request identifier to find, create, or mark a
  // reviewer. A stale environment-specific Clerk ID must fail closed.
  throw new Error(`Configured Clerk reviewer lookup failed (${configuredResponse.status})`);
}

async function seedReviewerFixture(reviewerUserId: string): Promise<void> {
  const adminKey = process.env["ADMIN_API_KEY"]?.trim();
  const port = process.env["PORT"]?.trim() || "8080";
  if (!adminKey) {
    throw new Error("Reviewer fixture seeding is not configured");
  }

  const response = await fetch(`http://127.0.0.1:${port}/api/admin/seed-reviewer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": adminKey,
    },
    body: JSON.stringify({ clerkId: reviewerUserId, tier: "free" }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Reviewer fixture seeding failed (${response.status})`);
  }
}

router.post(
  "/auth/app-review-ticket",
  reviewerAuthLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const reviewerUserId = (
      process.env["APP_REVIEW_USER_ID"] ??
      process.env["APP_REVIEW_CLERK_USER_ID"]
    )?.trim();
    const reviewAccessCode = process.env["APP_REVIEW_ACCESS_CODE"]?.trim();
    const clerkSecretKey = process.env["CLERK_SECRET_KEY"]?.trim();
    const identifier =
      typeof req.body?.identifier === "string" ? req.body.identifier.trim().toLowerCase() : "";
    const accessCode =
      typeof req.body?.accessCode === "string" ? req.body.accessCode.trim() : "";

    if (!reviewerUserId || !reviewAccessCode || !clerkSecretKey) {
      logger.error("App Review authentication is not configured");
      res.status(503).json({ error: "App Review access is temporarily unavailable." });
      return;
    }

    if (!identifier || !accessCode || !secureStringEqual(accessCode, reviewAccessCode)) {
      res.status(401).json({ error: "Invalid App Review credentials." });
      return;
    }

    try {
      const reviewer = await resolveReviewer(reviewerUserId, clerkSecretKey);
      const belongsToReviewer = reviewer.email_addresses?.some(
        (entry) => entry.email_address?.trim().toLowerCase() === identifier,
      );
      if (!belongsToReviewer) {
        res.status(401).json({ error: "Invalid App Review credentials." });
        return;
      }

      await seedReviewerFixture(reviewer.id);

      const ticketResponse = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: reviewer.id,
          expires_in_seconds: 60,
        }),
      });
      if (!ticketResponse.ok) {
        throw new Error(`Clerk sign-in ticket creation failed (${ticketResponse.status})`);
      }

      const ticket = (await ticketResponse.json()) as { token?: string };
      if (!ticket.token) {
        throw new Error("Clerk sign-in ticket response did not include a token");
      }

      logger.info({ reviewerUserId: reviewer.id }, "App Review sign-in ticket issued");
      res.json({ ticket: ticket.token });
    } catch (error) {
      logger.error({ err: error }, "App Review sign-in ticket failed");
      res.status(502).json({ error: "Could not start App Review access. Please try again." });
    }
  },
);

export default router;