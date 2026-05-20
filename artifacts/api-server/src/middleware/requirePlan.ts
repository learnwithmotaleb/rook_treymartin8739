import type { Request, Response, NextFunction } from "express";
import { getSubscription } from "../services/subscriptionService";
import { resolveUserId } from "../lib/demoUser";
import { tierAtLeast, type Tier } from "../lib/planConfig";

export function requirePlan(minTier: "pro" | "premium") {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = await resolveUserId(req.headers["x-user-id"]);
      const sub = await getSubscription(userId);

      if (!tierAtLeast(sub.tier, minTier as Tier)) {
        res.status(403).json({
          error: "upgrade_required",
          message: `This feature requires a ${minTier} plan or higher.`,
          requiredTier: minTier,
          currentTier: sub.tier,
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
