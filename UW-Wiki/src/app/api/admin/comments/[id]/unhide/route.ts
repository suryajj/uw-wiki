import { apiError, apiSuccess } from "@/lib/api/errors";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { embedVisibleComment } from "@/lib/comments/service";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) {
    return apiError("FORBIDDEN", "Reviewer access required.");
  }
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("comments").update({ is_hidden: false }).eq("id", id);
  if (error) return apiError("UNEXPECTED", "Could not unhide comment.");
  await embedVisibleComment(id).catch(console.error);
  await logAdminActivity({
    actorId: user.id,
    action: "unhide_comment",
    entityType: "comment",
    entityId: id,
    summary: "Unhid comment",
  });
  return apiSuccess({ message: "Comment unhidden." });
}
