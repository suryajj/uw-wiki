import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdminApi } from "@/lib/admin/auth";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { publishColdStartJob } from "@/lib/cold-start/service";
import { publishSchema } from "@/lib/cold-start/schemas";

const publishLimiter = createRateLimiter(10, "1 h");

type RouteCtx = { params: Promise<{ jobId: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const parsed = await parseJson(req, publishSchema);
  if (!parsed.ok) return parsed.response;
  const { jobId } = await params;
  const limit = await checkRateLimit(publishLimiter, `cold-start:publish:${admin.user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
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
