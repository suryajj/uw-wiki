import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { requireAdminApi } from "@/lib/admin/auth";
import { rerunColdStartJob } from "@/lib/cold-start/service";

type RouteCtx = { params: Promise<{ jobId: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const { jobId } = await params;
  try {
    const result = await rerunColdStartJob(jobId, admin.user);
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    logServerError("cold-start.rerun", error);
    return apiError("UNEXPECTED", "Could not rerun job.");
  }
}
