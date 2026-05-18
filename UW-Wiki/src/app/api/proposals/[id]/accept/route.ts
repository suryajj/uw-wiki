import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { acceptProposal, ProposalError } from "@/lib/proposals/service";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";

const acceptLimiter = createRateLimiter(20, "1 m");

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) {
    return apiError("FORBIDDEN", "Reviewer access required.");
  }
  const { id } = await params;
  const limit = await checkRateLimit(acceptLimiter, `proposals:accept:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  try {
    const result = await acceptProposal(id, user);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ProposalError) return apiError(error.code, error.message);
    logServerError("proposals.accept", error);
    return apiError("UNEXPECTED", "Could not accept proposal.");
  }
}
