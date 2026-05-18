import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const withdrawLimiter = createRateLimiter(10, "1 h");

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to withdraw proposals.");
  const { id } = await params;
  const limit = await checkRateLimit(withdrawLimiter, `proposals:withdraw:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const admin = createAdminClient();
  const { data: proposal } = await admin
    .from("edit_proposals")
    .select("contributor_id,status")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return apiError("NOT_FOUND", "Proposal not found.");
  if (!proposal.contributor_id || proposal.contributor_id !== user.id) {
    return apiError("FORBIDDEN", "Only the contributor can withdraw this proposal.");
  }
  if (!["pending", "changes_requested", "needs_rebase"].includes(proposal.status)) {
    return apiError("INVALID_STATE", "Proposal cannot be withdrawn in this state.");
  }
  const { error } = await admin
    .from("edit_proposals")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    logServerError("proposals.withdraw", error);
    return apiError("UNEXPECTED", "Could not withdraw proposal.");
  }
  return apiSuccess({ message: "Proposal withdrawn." });
}
