import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, scanJobsTable } from "@workspace/db";
import { resolveUserId } from "../lib/demoUser";
import { startScan } from "../services/scanOrchestrator";

const router: IRouter = Router();

router.post("/scan", async (req, res): Promise<void> => {
  const userId = await resolveUserId(req.headers["x-user-id"]);

  const runningJobs = await db
    .select({ id: scanJobsTable.id })
    .from(scanJobsTable)
    .where(
      and(
        eq(scanJobsTable.userId, userId),
        eq(scanJobsTable.status, "running")
      )
    );

  if (runningJobs.length > 0) {
    res.status(400).json({ error: "A scan is already in progress" });
    return;
  }

  const job = await startScan(userId);

  res.status(201).json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    threatsFound: job.threatsFound,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  });
});

router.get("/scan/:jobId", async (req, res): Promise<void> => {
  const userId = await resolveUserId(req.headers["x-user-id"]);
  const jobId = Array.isArray(req.params.jobId)
    ? req.params.jobId[0]
    : req.params.jobId;

  const [job] = await db
    .select()
    .from(scanJobsTable)
    .where(
      and(eq(scanJobsTable.id, jobId), eq(scanJobsTable.userId, userId))
    );

  if (!job) {
    res.status(404).json({ error: "Scan job not found" });
    return;
  }

  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    threatsFound: job.threatsFound,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  });
});

export default router;
