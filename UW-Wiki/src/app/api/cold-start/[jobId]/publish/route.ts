import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { logAdminActivity } from "@/lib/admin/activity-log";
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
    await logAdminActivity({
      actorId: admin.user.id,
      action: "publish_cold_start",
      entityType: "cold_start_job",
      entityId: jobId,
      summary: "Published cold-start draft",
      metadata: {
        org_slug: result.orgSlug,
        page_id: result.pageId,
        page_version_id: result.pageVersionId,
      },
    });
    return apiSuccess(result);
  } catch (error) {
    logServerError("cold-start.publish", error);
    return apiError("UNEXPECTED", "Could not publish draft.");
  }
}
