import { apiError, apiSuccess } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ProposalError, refreshMergeability } from "@/lib/proposals/service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) {
    return apiError("FORBIDDEN", "Reviewer access required.");
  }
  const { id } = await params;
  try {
    const mergeability = await refreshMergeability(id);
    return apiSuccess({ mergeability });
  } catch (error) {
    if (error instanceof ProposalError) return apiError(error.code, error.message);
    return apiError("UNEXPECTED", "Could not refresh mergeability.");
  }
}
