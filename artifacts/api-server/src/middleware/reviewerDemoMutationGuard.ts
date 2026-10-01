import type { NextFunction, Request, Response } from "express";
import { isDesignatedReviewer } from "../services/reviewerService";

type GuardedOperation = {
  method: string;
  path: RegExp;
};

const GUARDED_OPERATIONS: GuardedOperation[] = [
  { method: "POST", path: /^\/oauth\/(?:state|x\/init)$/ },
  { method: "POST", path: /^\/scan$/ },
  { method: "POST", path: /^\/photos\/search$/ },
  { method: "GET", path: /^\/accounts\/[^/]+\/media$/ },
  { method: "POST", path: /^\/accounts$/ },
  { method: "PATCH", path: /^\/accounts\/[^/]+$/ },
  { method: "POST", path: /^\/accounts\/refresh$/ },
  { method: "DELETE", path: /^\/accounts\/[^/]+$/ },
  { method: "PATCH", path: /^\/threats\/(?:bulk-resolve|[^/]+\/resolve)$/ },
  { method: "PATCH", path: /^\/me$/ },
  { method: "PATCH", path: /^\/me\/avatar$/ },
  { method: "DELETE", path: /^\/me$/ },
  { method: "POST", path: /^\/me\/onboarding$/ },
  { method: "POST", path: /^\/me\/photo-consent$/ },
  { method: "DELETE", path: /^\/me\/(?:photo-consent|photo-data)$/ },
  { method: "PATCH", path: /^\/notifications\/token$/ },
  { method: "DELETE", path: /^\/notifications\/token$/ },
  { method: "POST", path: /^\/ai\/[^/]+$/ },
  // These identity endpoints can persist verification results/keys even when
  // exposed as reads (identity/profile computes and saves a missing profile).
  { method: "GET", path: /^\/identity\/profile$/ },
  { method: "POST", path: /^\/identity\/(?:verify-account|api-keys)$/ },
  { method: "POST", path: /^\/fingerprint\/similar$/ },
  { method: "POST", path: /^\/billing\/cancellation-survey$/ },
  // Management/data-plane writes exposed by the separately mounted v1 router.
  { method: "POST", path: /^\/v1\/(?:keys|webhooks|scans)$/ },
  { method: "DELETE", path: /^\/v1\/(?:keys|webhooks)\/[^/]+$/ },
];

export function isReviewerDemoGuardedOperation(method: string, path: string): boolean {
  const normalizedMethod = method.toUpperCase();
  return GUARDED_OPERATIONS.some(
    (operation) => operation.method === normalizedMethod && operation.path.test(path),
  );
}

type ReviewerCheck = (userId: string | undefined, clerkId?: string) => Promise<boolean>;

type GuardLogger = Pick<Request["log"], "error">;

export async function rejectReviewerDemoOperation(
  userId: string | undefined,
  clerkId: string | undefined,
  res: Response,
  log: GuardLogger,
  checkReviewer: ReviewerCheck = isDesignatedReviewer,
): Promise<boolean> {
  try {
    if (!(await checkReviewer(userId, clerkId))) return false;
  } catch (err) {
    log.error({ err }, "Reviewer demo mutation guard failed closed");
    res.status(503).json({
      error: "reviewer_guard_unavailable",
      message: "This operation is temporarily unavailable.",
    });
    return true;
  }

  res.status(409).json({
    error: "reviewer_demo_preview_only",
    message: "This operation is unavailable in reviewer demo preview.",
  });
  return true;
}

export function createReviewerDemoMutationGuard(
  checkReviewer: ReviewerCheck = isDesignatedReviewer,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!isReviewerDemoGuardedOperation(req.method, req.path)) {
      next();
      return;
    }

    // API-key-authenticated data-plane requests do not have req.userId or
    // req.clerkId. Their owner is set only by apiKeyAuth from the stored key,
    // never from a request body or query parameter.
    const authenticatedUserId = req.apiKeyUserId ?? req.userId;
    if (!(await rejectReviewerDemoOperation(
      authenticatedUserId,
      req.clerkId,
      res,
      req.log,
      checkReviewer,
    ))) {
      next();
    }
  };
}

export const reviewerDemoMutationGuard = createReviewerDemoMutationGuard();