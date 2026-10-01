import { Router, type IRouter } from "express";
import { GetReviewerDemoResponse } from "@workspace/api-zod";
import { getReviewerDemoPayloadForUser } from "../services/reviewerDemoService";

const router: IRouter = Router();

export const REVIEWER_DEMO_NOT_AUTHORIZED_RESPONSE = {
  error: "reviewer_demo_not_authorized",
  mode: "live",
} as const;

router.get("/reviewer/demo", async (req, res): Promise<void> => {
  try {
    const payload = await getReviewerDemoPayloadForUser(req.userId);
    if (!payload) {
      res.status(404).json(REVIEWER_DEMO_NOT_AUTHORIZED_RESPONSE);
      return;
    }
    res.json(GetReviewerDemoResponse.parse(payload));
  } catch (err) {
    req.log.error({ err }, "GET /reviewer/demo failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;