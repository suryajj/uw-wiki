import { apiError, apiSuccess } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadProposalDetail } from "@/lib/proposals/service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to view proposal details.");
  const { id } = await params;
  const detail = await loadProposalDetail(id);
  if (!detail) return apiError("NOT_FOUND", "Proposal not found.");
  const proposal = detail.proposal;
  const canView =
    proposal.contributor_id === user.id ||
    user.role === "reviewer" ||
    user.role === "admin";
  if (!canView) return apiError("FORBIDDEN", "You cannot view this proposal.");
  return apiSuccess({ detail });
}
