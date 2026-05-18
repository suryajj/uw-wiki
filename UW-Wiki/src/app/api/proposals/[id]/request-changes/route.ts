import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { emitNotification } from "@/lib/notifications/service";
import { recordDecisionLog, reviewerAffiliationForProposal } from "@/lib/proposals/service";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const requestChangesLimiter = createRateLimiter(20, "1 m");

type RouteCtx = { params: Promise<{ id: string }> };

const schema = z.object({
  message: z.string().trim().min(10).max(2000),
});

export async function POST(req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) {
    return apiError("FORBIDDEN", "Reviewer access required.");
  }
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  const limit = await checkRateLimit(requestChangesLimiter, `proposals:request-changes:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const admin = createAdminClient();
  const { data: proposal } = await admin
    .from("edit_proposals")
    .select("contributor_id,status,page_id,pages(slug,organizations(org_slug))")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return apiError("NOT_FOUND", "Proposal not found.");
  if (proposal.contributor_id === user.id && user.role !== "admin") {
    return apiError("FORBIDDEN", "Reviewers cannot review their own proposal.");
  }
  if (proposal.status !== "pending") {
    return apiError("INVALID_STATE", "Only pending proposals can request changes.");
  }
  const isReviewerAffiliated = await reviewerAffiliationForProposal(id, user.id);
  const { data: patchset } = await admin
    .from("edit_proposal_patchsets")
    .select("id")
    .eq("proposal_id", id)
    .eq("is_current", true)
    .maybeSingle();
  const { error: reviewCommentError } = await admin
    .from("proposal_review_comments")
    .insert({
      proposal_id: id,
      patchset_id: patchset?.id ?? null,
      reviewer_id: user.id,
      message: parsed.data.message,
      section_suggestions: [],
    });
  if (reviewCommentError) {
    logServerError("proposals.request-changes.review-comment", reviewCommentError);
    return apiError("UNEXPECTED", "Could not save review comment.");
  }
  const { error } = await admin
    .from("edit_proposals")
    .update({
      status: "changes_requested",
      reviewer_id: user.id,
      reviewer_comment: parsed.data.message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    logServerError("proposals.request-changes", error);
    return apiError("UNEXPECTED", "Could not request changes.");
  }
  await recordDecisionLog(id, {
    action: "request_changes",
    reviewerId: user.id,
    isReviewerAffiliated,
    note: parsed.data.message,
  });
  await logAdminActivity({
    actorId: user.id,
    action: "request_changes",
    entityType: "edit_proposal",
    entityId: id,
    summary: "Requested changes on proposal",
    metadata: { is_reviewer_affiliated: isReviewerAffiliated },
  });
  const page = Array.isArray(proposal.pages) ? proposal.pages[0] : proposal.pages;
  const org = Array.isArray(page?.organizations) ? page?.organizations[0] : page?.organizations;
  await emitNotification({
    recipientId: proposal.contributor_id,
    type: "pr.changes_requested",
    payload: {
      title: "Changes requested on your proposal",
      body: parsed.data.message,
      href: page?.slug ? `/wiki/${page.slug}/proposals/${id}` : "/my/contributions",
      proposalId: id,
      pageId: proposal.page_id,
      orgSlug: org?.org_slug,
    },
  }).catch((err) => logServerError("notifications.pr.changes_requested", err));
  return apiSuccess({ message: "Changes requested.", isReviewerAffiliated });
}
