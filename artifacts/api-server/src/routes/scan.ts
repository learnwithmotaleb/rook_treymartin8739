import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, scanJobsTable } from "@workspace/db";

import { startScan } from "../services/scanOrchestrator";

const router: IRouter = Router();

function serializeJob(job: typeof scanJobsTable.$inferSelect) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    threatsFound: job.threatsFound,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

router.post("/scan", async (req, res): Promise<void> => {
  const userId = req.userId;

  const activeJobs = await db
    .select()
    .from(scanJobsTable)
    .where(
      and(
        eq(scanJobsTable.userId, userId),
        eq(scanJobsTable.status, "running")
      )
    );

  if (activeJobs.length > 0 && activeJobs[0]) {
    // Return the existing running job so the client can poll it
    res.status(200).json(serializeJob(activeJobs[0]));
    return;
  }

  const job = await startScan(userId);
  res.status(201).json(serializeJob(job));
});

router.get("/scan/latest", async (req, res): Promise<void> => {
  const userId = req.userId;

  const [job] = await db
    .select()
    .from(scanJobsTable)
    .where(eq(scanJobsTable.userId, userId))
    .orderBy(desc(scanJobsTable.startedAt))
    .limit(1);

  if (!job) {
    res.status(404).json({ error: "No scans found" });
    return;
  }

  res.json(serializeJob(job));
});

router.get("/scan/:jobId", async (req, res): Promise<void> => {
  const userId = req.userId;
  const jobId = Array.isArray(req.params.jobId)
    ? req.params.jobId[0]
    : req.params.jobId;

  if (!jobId) {
    res.status(400).json({ error: "Missing jobId" });
    return;
  }

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

  res.json(serializeJob(job));
});

export default router;
