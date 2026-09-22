import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", async (req, res): Promise<void> => {
  try {
    // A process-only health response hides the most common production failure:
    // the API is up while its database connection pool is unavailable.
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("database health check timed out")), 2_000)
      ),
    ]);
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.status(200).json(data);
  } catch (err) {
    req.log.error({ err }, "health check failed");
    res.status(503).json({ status: "unhealthy", error: "database unavailable" });
  }
});

export default router;
