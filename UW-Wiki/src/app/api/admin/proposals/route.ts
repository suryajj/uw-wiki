import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listProposalQueue } from "@/lib/proposals/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) {
    return apiError("FORBIDDEN", "Reviewer access required.");
  }
  try {
    const proposals = await listProposalQueue();
    return apiSuccess({ proposals });
  } catch (error) {
    logServerError("admin.proposals.list", error);
    return apiError("UNEXPECTED", "Could not load proposals.");
  }
}
