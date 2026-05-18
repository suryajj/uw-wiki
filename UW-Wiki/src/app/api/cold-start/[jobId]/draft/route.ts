import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { requireAdminApi } from "@/lib/admin/auth";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { updateColdStartDraft } from "@/lib/cold-start/service";
import { updateDraftSchema } from "@/lib/cold-start/schemas";

const draftLimiter = createRateLimiter(10, "1 h");

type RouteCtx = { params: Promise<{ jobId: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const parsed = await parseJson(req, updateDraftSchema);
  if (!parsed.ok) return parsed.response;
  const { jobId } = await params;
  const limit = await checkRateLimit(draftLimiter, `cold-start:draft:${admin.user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  try {
    await updateColdStartDraft(jobId, parsed.data.contentJson);
    return apiSuccess({ message: "Draft updated." });
  } catch (error) {
    logServerError("cold-start.draft", error);
    return apiError("INVALID_CONTENT", "Draft content is invalid.");
  }
}
