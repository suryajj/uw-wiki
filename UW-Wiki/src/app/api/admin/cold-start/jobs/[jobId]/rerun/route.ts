import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdminApi } from "@/lib/admin/auth";
import { rerunColdStartJob } from "@/lib/cold-start/service";

type RouteCtx = { params: Promise<{ jobId: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const { jobId } = await params;
  try {
    const result = await rerunColdStartJob(jobId, admin.user);
    await logAdminActivity({
      actorId: admin.user.id,
      action: "rerun_cold_start",
      entityType: "cold_start_job",
      entityId: jobId,
      summary: "Re-ran cold-start job",
      metadata: { new_job_id: result.jobId },
    });
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    logServerError("cold-start.rerun", error);
    if (error instanceof Error && error.message.includes("Only failed")) {
      return apiError("INVALID_STATE", error.message);
    }
    return apiError("UNEXPECTED", "Could not rerun job.");
  }
}
