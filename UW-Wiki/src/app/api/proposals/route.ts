import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { enforceProposalCreateLimit } from "@/lib/proposals/rate-limits";
import {
  createProposal,
  createProposalSchema,
  ProposalError,
} from "@/lib/proposals/service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseJson(req, createProposalSchema);
  if (!parsed.ok) return parsed.response;
  const user = await getCurrentUser();
  const rateResponse = await enforceProposalCreateLimit(req, user);
  if (rateResponse) return rateResponse;
  try {
    const result = await createProposal(parsed.data, user);
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    if (error instanceof ProposalError) {
      return apiError(error.code, error.message);
    }
    logServerError("proposals.create", error);
    return apiError("UNEXPECTED", "Could not create proposal.");
  }
}
