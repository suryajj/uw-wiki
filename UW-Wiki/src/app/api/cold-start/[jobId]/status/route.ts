import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { requireAdminApi } from "@/lib/admin/auth";
import { getColdStartJob } from "@/lib/cold-start/service";

type RouteCtx = { params: Promise<{ jobId: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const { jobId } = await params;
  try {
    const job = await getColdStartJob(jobId);
    if (!job) return apiError("NOT_FOUND", "Cold-start job not found.");
    return apiSuccess({ job });
  } catch (error) {
    logServerError("cold-start.status", error);
    return apiError("UNEXPECTED", "Could not load job.");
  }
}
