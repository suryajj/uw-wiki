import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { deleteCommentChunk } from "@/lib/comments/service";
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
  const limit = await checkRateLimit(adminActionLimiter, `admin:hide:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const admin = createAdminClient();
  const { error } = await admin.from("comments").update({ is_hidden: true }).eq("id", id);
  if (error) {
    logServerError("comments.hide", error);
    return apiError("UNEXPECTED", "Could not hide comment.");
  }
  await deleteCommentChunk(id);
  await admin
    .from("comment_reports")
    .update({
      status: "resolved",
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("comment_id", id)
    .eq("status", "pending");
  await logAdminActivity({
    actorId: user.id,
    action: "hide_comment",
    entityType: "comment",
    entityId: id,
    summary: "Hid reported comment",
  });
  return apiSuccess({ message: "Comment hidden." });
}
