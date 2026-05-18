import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { embedVisibleComment } from "@/lib/comments/service";
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
  const limit = await checkRateLimit(adminActionLimiter, `admin:unhide:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const admin = createAdminClient();
  const { error } = await admin.from("comments").update({ is_hidden: false }).eq("id", id);
  if (error) {
    logServerError("comments.unhide", error);
    return apiError("UNEXPECTED", "Could not unhide comment.");
  }
  await embedVisibleComment(id).catch((err) => logServerError("comments.unhide.embed", err));
  await logAdminActivity({
    actorId: user.id,
    action: "unhide_comment",
    entityType: "comment",
    entityId: id,
    summary: "Unhid comment",
  });
  return apiSuccess({ message: "Comment unhidden." });
}
