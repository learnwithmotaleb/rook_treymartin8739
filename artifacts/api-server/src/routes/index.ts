import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/requireAuth";
import healthRouter from "./health";
import usersRouter from "./users";
import accountsRouter from "./accounts";
import scanRouter from "./scan";
import threatsRouter from "./threats";
import fingerprintRouter from "./fingerprint";
import aiAnalysisRouter from "./aiAnalysis";
import darkWebRouter from "./darkweb";
import billingRouter from "./billing";
import legalRouter from "./legal";
import oauthRouter from "./oauth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(legalRouter);
router.use(oauthRouter);

router.use(requireAuth);

router.use(usersRouter);
router.use(accountsRouter);
router.use(scanRouter);
router.use(threatsRouter);
router.use(fingerprintRouter);
router.use(aiAnalysisRouter);
router.use(darkWebRouter);
router.use(billingRouter);

export default router;
