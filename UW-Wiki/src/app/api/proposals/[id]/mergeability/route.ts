import { apiError, apiSuccess } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ProposalError, refreshMergeability } from "@/lib/proposals/service";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";

const mergeabilityLimiter = createRateLimiter(30, "1 m");

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) {
    return apiError("FORBIDDEN", "Reviewer access required.");
  }
  const { id } = await params;
  const limit = await checkRateLimit(mergeabilityLimiter, `proposals:mergeability:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  try {
    const mergeability = await refreshMergeability(id);
    return apiSuccess({ mergeability });
  } catch (error) {
    if (error instanceof ProposalError) return apiError(error.code, error.message);
    return apiError("UNEXPECTED", "Could not refresh mergeability.");
  }
}
