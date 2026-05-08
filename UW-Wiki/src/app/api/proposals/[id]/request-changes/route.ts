import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordDecisionLog, reviewerAffiliationForProposal } from "@/lib/proposals/service";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const admin = createAdminClient();
  const { data: proposal } = await admin
    .from("edit_proposals")
    .select("contributor_id,status")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return apiError("NOT_FOUND", "Proposal not found.");
  if (proposal.contributor_id === user.id) {
    return apiError("FORBIDDEN", "Reviewers cannot review their own proposal.");
  }
  if (proposal.status !== "pending") {
    return apiError("INVALID_STATE", "Only pending proposals can request changes.");
  }
  const isReviewerAffiliated = await reviewerAffiliationForProposal(id, user.id);
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
  return apiSuccess({ message: "Changes requested.", isReviewerAffiliated });
}
