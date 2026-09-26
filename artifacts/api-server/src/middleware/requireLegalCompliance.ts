import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

export const CURRENT_TERMS_VERSION = "2026-09-15-v4";
export const CURRENT_AGE_VERSION = "1.0";

const recoveryEndpoints = new Set([
  "GET /me",
  "POST /me/terms",
  "POST /me/age-confirm",
  "DELETE /me",
]);

/**
 * Authenticated app APIs remain unavailable until the current Terms and age
 * acknowledgements are durably recorded. Status/error checks fail closed;
 * only the narrow recovery endpoints above bypass this gate.
 */
export async function requireLegalCompliance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (recoveryEndpoints.has(`${req.method} ${req.path}`)) {
    next();
    return;
  }

  try {
    const [user] = await db
      .select({
        termsAcceptedAt: usersTable.termsAcceptedAt,
        termsVersion: usersTable.termsVersion,
        ageConfirmedAt: usersTable.ageConfirmedAt,
        minimumAgeVersion: usersTable.minimumAgeVersion,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId));

    if (
      user?.termsAcceptedAt &&
      user.termsVersion === CURRENT_TERMS_VERSION &&
      user.ageConfirmedAt &&
      user.minimumAgeVersion === CURRENT_AGE_VERSION
    ) {
      next();
      return;
    }

    res.status(403).json({
      error: "legal_compliance_required",
      message: "Accept the current Terms and confirm you are at least 17 to continue.",
    });
  } catch (err) {
    req.log.error({ err, userId: req.userId }, "Legal compliance check failed");
    res.status(503).json({
      error: "legal_compliance_unavailable",
      message: "We could not verify your legal acknowledgements. Please retry.",
    });
  }
}