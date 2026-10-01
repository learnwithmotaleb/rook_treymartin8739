import { buildReviewerDemoPayload } from "./reviewerDemoFixtures";

type ReviewerCheck = (userId: string) => Promise<boolean>;

export async function getReviewerDemoPayloadForUser(
  userId: string,
  reviewerCheck?: ReviewerCheck,
) {
  const isReviewer =
    reviewerCheck ?? (await import("./reviewerService")).isDesignatedReviewer;
  if (!(await isReviewer(userId))) return null;
  return buildReviewerDemoPayload();
}