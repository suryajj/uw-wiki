import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteCommentChunk, embedVisibleComment } from "@/lib/comments/service";

const editLimiter = createRateLimiter(10, "1 h");
const deleteLimiter = createRateLimiter(10, "1 h");

const patchSchema = z.object({
  body: z.string().trim().min(1).max(1500),
});

type RouteCtx = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to edit comments.");
  const { id } = await params;
  const limit = await checkRateLimit(editLimiter, `comments:edit:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const parsed = await parseJson(req, patchSchema);
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("comments")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();
  if (!comment) return apiError("NOT_FOUND", "Comment not found.");
  if (comment.author_id !== user.id && user.role !== "admin") {
    return apiError("FORBIDDEN", "You can only edit your own comments.");
  }

  const { error } = await admin
    .from("comments")
    .update({
      body: parsed.data.body,
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    logServerError("comments.patch", error);
    return apiError("UNEXPECTED", "Could not update comment.");
  }
  await embedVisibleComment(id).catch((embedError) =>
    logServerError("comments.patch.embed", embedError),
  );
  return apiSuccess({ message: "Comment updated." });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to delete comments.");
  const { id } = await params;
  const limit = await checkRateLimit(deleteLimiter, `comments:delete:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("comments")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();
  if (!comment) return apiError("NOT_FOUND", "Comment not found.");
  if (comment.author_id !== user.id && user.role !== "admin") {
    return apiError("FORBIDDEN", "You can only delete your own comments.");
  }
  await deleteCommentChunk(id);
  const { error } = await admin.from("comments").delete().eq("id", id);
  if (error) {
    logServerError("comments.delete", error);
    return apiError("UNEXPECTED", "Could not delete comment.");
  }
  return apiSuccess({ message: "Comment deleted." });
}
