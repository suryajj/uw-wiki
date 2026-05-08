import { apiError, apiSuccess } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to withdraw proposals.");
  const { id } = await params;
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
  await admin
    .from("edit_proposals")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", id);
  return apiSuccess({ message: "Proposal withdrawn." });
}
