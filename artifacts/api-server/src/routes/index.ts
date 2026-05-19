import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import accountsRouter from "./accounts";
import scanRouter from "./scan";
import threatsRouter from "./threats";
import fingerprintRouter from "./fingerprint";
import aiAnalysisRouter from "./aiAnalysis";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(accountsRouter);
router.use(scanRouter);
router.use(threatsRouter);
router.use(fingerprintRouter);
router.use(aiAnalysisRouter);

export default router;
