import { apiError, apiSuccess } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { deleteCommentChunk } from "@/lib/comments/service";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) {
    return apiError("FORBIDDEN", "Reviewer access required.");
  }
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("comments").update({ is_hidden: true }).eq("id", id);
  if (error) return apiError("UNEXPECTED", "Could not hide comment.");
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
  return apiSuccess({ message: "Comment hidden." });
}
