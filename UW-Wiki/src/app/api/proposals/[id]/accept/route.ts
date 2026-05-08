import { apiError, apiSuccess } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { acceptProposal, ProposalError } from "@/lib/proposals/service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) {
    return apiError("FORBIDDEN", "Reviewer access required.");
  }
  const { id } = await params;
  try {
    const result = await acceptProposal(id, user);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ProposalError) return apiError(error.code, error.message);
    console.error(error);
    return apiError("UNEXPECTED", "Could not accept proposal.");
  }
}
