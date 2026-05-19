import { Router, type IRouter } from "express";
import { resolveUserId } from "../lib/demoUser";
import { getFingerprintForUser } from "../services/fingerprintService";

const router: IRouter = Router();

router.get("/fingerprint", async (req, res): Promise<void> => {
  const userId = await resolveUserId(req.headers["x-user-id"]);
  const fingerprint = await getFingerprintForUser(userId);

  res.json({
    totalPhotosIndexed: fingerprint.totalPhotosIndexed,
    totalCaptionsIndexed: fingerprint.totalCaptionsIndexed,
    reelsIndexed: fingerprint.reelsIndexed,
    monitoredAccounts: fingerprint.monitoredAccounts,
    lastUpdated: fingerprint.lastUpdated,
    platforms: fingerprint.platforms,
  });
});

export default router;
