import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { requireAdminApi } from "@/lib/admin/auth";
import { publishColdStartJob } from "@/lib/cold-start/service";
import { publishSchema } from "@/lib/cold-start/schemas";

type RouteCtx = { params: Promise<{ jobId: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const parsed = await parseJson(req, publishSchema);
  if (!parsed.ok) return parsed.response;
  const { jobId } = await params;
  try {
    const result = await publishColdStartJob(jobId, parsed.data.contentJson);
    return apiSuccess(result);
  } catch (error) {
    logServerError("cold-start.publish", error);
    return apiError("UNEXPECTED", "Could not publish draft.");
  }
}
