import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN ?? "rook_webhook_verify";

/**
 * Meta webhook verification (GET).
 * Meta sends hub.mode, hub.challenge, hub.verify_token.
 * We echo back hub.challenge to confirm ownership.
 */
function handleVerification(req: Request, res: Response): void {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    req.log.info({ mode, token }, "Meta webhook verified");
    res.status(200).send(challenge);
    return;
  }

  req.log.warn({ mode, token }, "Meta webhook verification failed — token mismatch");
  res.status(403).json({ error: "Verification failed" });
}

/**
 * Meta webhook event (POST).
 * Accepts Instagram and Facebook change notifications.
 * Extend here to process real-time events when needed.
 */
function handleEvent(req: Request, res: Response): void {
  req.log.info({ body: req.body }, "Meta webhook event received");
  res.status(200).json({ status: "ok" });
}

router.get("/webhooks/instagram", handleVerification);
router.post("/webhooks/instagram", handleEvent);

router.get("/webhooks/facebook", handleVerification);
router.post("/webhooks/facebook", handleEvent);

export default router;
