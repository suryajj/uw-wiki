import { apiError, apiSuccess } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listProposalQueue } from "@/lib/proposals/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) {
    return apiError("FORBIDDEN", "Reviewer access required.");
  }
  const proposals = await listProposalQueue();
  return apiSuccess({ proposals });
}
