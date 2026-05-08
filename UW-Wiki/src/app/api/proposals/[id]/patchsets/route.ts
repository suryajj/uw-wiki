import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { enforcePatchsetLimit } from "@/lib/proposals/rate-limits";
import {
  createPatchset,
  createProposalSchema,
  ProposalError,
} from "@/lib/proposals/service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to submit patchsets.");
  const { id } = await params;
  const rateResponse = await enforcePatchsetLimit(user, id);
  if (rateResponse) return rateResponse;
  const parsed = await parseJson(req, createProposalSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await createPatchset(id, parsed.data, user);
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    if (error instanceof ProposalError) return apiError(error.code, error.message);
    logServerError("proposals.patchset", error);
    return apiError("UNEXPECTED", "Could not submit patchset.");
  }
}
