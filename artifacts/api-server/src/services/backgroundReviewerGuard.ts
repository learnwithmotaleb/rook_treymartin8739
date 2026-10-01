import { logger } from "../lib/logger";
import { isDesignatedReviewer } from "./reviewerService";

type ReviewerCheck = (userId: string) => Promise<boolean>;

/**
 * A background job must not process a reviewer if trusted identity resolution
 * is unavailable. That keeps provider, scan, and notification work fail-closed
 * without changing the behavior of ordinary users when the lookup succeeds.
 */
export async function shouldSkipReviewerBackgroundWork(
  userId: string,
  checkReviewer: ReviewerCheck = isDesignatedReviewer,
): Promise<boolean> {
  try {
    return await checkReviewer(userId);
  } catch (err) {
    logger.warn(
      { err, userId },
      "Skipping background work because reviewer designation could not be verified",
    );
    return true;
  }
}