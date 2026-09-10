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
      const userResponse = await fetch(`https://api.clerk.com/v1/users/${reviewerUserId}`, {
        headers: { Authorization: `Bearer ${clerkSecretKey}` },
      });
      if (!userResponse.ok) {
        throw new Error(`Clerk user lookup failed (${userResponse.status})`);
      }

      const reviewer = (await userResponse.json()) as {
        email_addresses?: Array<{ email_address?: string }>;
      };
      const belongsToReviewer = reviewer.email_addresses?.some(
        (entry) => entry.email_address?.trim().toLowerCase() === identifier,
      );
      if (!belongsToReviewer) {
        res.status(401).json({ error: "Invalid App Review credentials." });
        return;
      }

      const ticketResponse = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: reviewerUserId,
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

      logger.info({ reviewerUserId }, "App Review sign-in ticket issued");
      res.json({ ticket: ticket.token });
    } catch (error) {
      logger.error({ err: error }, "App Review sign-in ticket failed");
      res.status(502).json({ error: "Could not start App Review access. Please try again." });
    }
  },
);

export default router;