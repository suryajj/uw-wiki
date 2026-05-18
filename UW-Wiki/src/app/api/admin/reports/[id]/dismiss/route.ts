import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const adminActionLimiter = createRateLimiter(30, "1 m");

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) {
    return apiError("FORBIDDEN", "Reviewer access required.");
  }
  const { id } = await params;
  const limit = await checkRateLimit(adminActionLimiter, `admin:dismiss:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("comment_reports")
    .update({
      status: "dismissed",
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    logServerError("reports.dismiss", error);
    return apiError("UNEXPECTED", "Could not dismiss report.");
  }
  await logAdminActivity({
    actorId: user.id,
    action: "dismiss_report",
    entityType: "comment_report",
    entityId: id,
    summary: "Dismissed comment report",
  });
  return apiSuccess({ message: "Report dismissed." });
}
