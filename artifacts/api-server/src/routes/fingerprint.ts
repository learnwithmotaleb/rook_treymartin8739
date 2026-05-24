import { Router, type IRouter } from "express";

import { getFingerprintForUser } from "../services/fingerprintService";

const router: IRouter = Router();

router.get("/fingerprint", async (req, res): Promise<void> => {
  const userId = req.userId;
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
