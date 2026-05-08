import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { requireAdminApi } from "@/lib/admin/auth";
import { updateColdStartDraft } from "@/lib/cold-start/service";
import { updateDraftSchema } from "@/lib/cold-start/schemas";

type RouteCtx = { params: Promise<{ jobId: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const parsed = await parseJson(req, updateDraftSchema);
  if (!parsed.ok) return parsed.response;
  const { jobId } = await params;
  try {
    await updateColdStartDraft(jobId, parsed.data.contentJson);
    return apiSuccess({ message: "Draft updated." });
  } catch (error) {
    logServerError("cold-start.draft", error);
    return apiError("INVALID_CONTENT", "Draft content is invalid.");
  }
}
