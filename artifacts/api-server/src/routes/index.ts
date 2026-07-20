import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/requireAuth";
import healthRouter from "./health";
import usersRouter from "./users";
import accountsRouter from "./accounts";
import scanRouter from "./scan";
import threatsRouter from "./threats";
import fingerprintRouter from "./fingerprint";
import aiAnalysisRouter from "./aiAnalysis";
import billingRouter from "./billing";
import legalRouter from "./legal";
import oauthRouter from "./oauth";
import notificationsRouter from "./notifications";
import adminRouter from "./admin";
import v1Router from "./v1";
import waitlistRouter from "./waitlist";
import photosRouter from "./photos";
import intelligenceRouter from "./intelligence";
import identityRouter from "./identity";
import webhooksRouter from "./webhooks";
import rcWebhookRouter from "./rcWebhook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(legalRouter);
router.use(oauthRouter);
router.use(webhooksRouter);
router.use(rcWebhookRouter);
router.use(waitlistRouter);
router.use(adminRouter); // admin routes use their own X-Admin-Key auth

// Developer API v1 — API key auth handled inside v1Router
router.use(v1Router);

router.use(requireAuth);

router.use(usersRouter);
router.use(accountsRouter);
router.use(scanRouter);
router.use(threatsRouter);
router.use(fingerprintRouter);
router.use(aiAnalysisRouter);
router.use(billingRouter);
router.use(notificationsRouter);
router.use(photosRouter);
router.use(intelligenceRouter);
router.use(identityRouter);

export default router;
