import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { emitNotification } from "@/lib/notifications/service";
import { recordDecisionLog, reviewerAffiliationForProposal } from "@/lib/proposals/service";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const rejectLimiter = createRateLimiter(20, "1 m");

type RouteCtx = { params: Promise<{ id: string }> };

const rejectSchema = z.object({
  reviewerComment: z.string().trim().min(10).max(2000),
});

export async function POST(req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) {
    return apiError("FORBIDDEN", "Reviewer access required.");
  }
  const parsed = await parseJson(req, rejectSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  const limit = await checkRateLimit(rejectLimiter, `proposals:reject:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const admin = createAdminClient();
  const { data: proposal } = await admin
    .from("edit_proposals")
    .select("contributor_id,status,page_id,pages(slug,organizations(org_slug))")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return apiError("NOT_FOUND", "Proposal not found.");
  if (proposal.contributor_id === user.id) {
    return apiError("FORBIDDEN", "Reviewers cannot reject their own proposal.");
  }
  if (proposal.status !== "pending" && proposal.status !== "changes_requested") {
    return apiError("INVALID_STATE", "Proposal cannot be rejected in this state.");
  }
  const isReviewerAffiliated = await reviewerAffiliationForProposal(id, user.id);
  const { error } = await admin
    .from("edit_proposals")
    .update({
      status: "rejected",
      reviewer_id: user.id,
      reviewer_comment: parsed.data.reviewerComment,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    logServerError("proposals.reject", error);
    return apiError("UNEXPECTED", "Could not reject proposal.");
  }
  await recordDecisionLog(id, {
    action: "reject",
    reviewerId: user.id,
    isReviewerAffiliated,
    note: parsed.data.reviewerComment,
  });
  await logAdminActivity({
    actorId: user.id,
    action: "reject_proposal",
    entityType: "edit_proposal",
    entityId: id,
    summary: "Rejected proposal",
    metadata: { is_reviewer_affiliated: isReviewerAffiliated },
  });
  const page = Array.isArray(proposal.pages) ? proposal.pages[0] : proposal.pages;
  const org = Array.isArray(page?.organizations) ? page?.organizations[0] : page?.organizations;
  await emitNotification({
    recipientId: proposal.contributor_id,
    type: "pr.rejected",
    payload: {
      title: "Your proposal was rejected",
      body: parsed.data.reviewerComment,
      href: page?.slug ? `/wiki/${page.slug}/proposals/${id}` : "/my/contributions",
      proposalId: id,
      pageId: proposal.page_id,
      orgSlug: org?.org_slug,
    },
  }).catch((err) => logServerError("notifications.pr.rejected", err));
  return apiSuccess({ message: "Proposal rejected.", isReviewerAffiliated });
}
