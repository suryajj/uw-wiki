import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { enforceCommentRateLimits } from "@/lib/comments/rate-limits";
import { embedVisibleComment, listCommentsForPage } from "@/lib/comments/service";
import { createAdminClient } from "@/lib/supabase/admin";

const replySchema = z.object({
  body: z.string().trim().min(1).max(1500),
  isAnonymous: z.boolean().default(true),
});

type RouteCtx = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  const rateResponse = await enforceCommentRateLimits(req, user);
  if (rateResponse) return rateResponse;

  const { id } = await params;
  const parsed = await parseJson(req, replySchema);
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: parent } = await admin
    .from("comments")
    .select("id,page_id,parent_comment_id,section_slug,anchor_text,is_hidden")
    .eq("id", id)
    .maybeSingle();
  if (!parent) return apiError("NOT_FOUND", "Parent comment not found.");
  if (parent.is_hidden) {
    return apiError("FORBIDDEN", "Cannot reply to a hidden comment.");
  }
  if (parent.parent_comment_id) {
    return apiError(
      "VALIDATION_FAILED",
      "Replies cannot be nested deeper than two levels.",
    );
  }

  const { data: inserted, error } = await admin
    .from("comments")
    .insert({
      page_id: parent.page_id,
      parent_comment_id: parent.id,
      author_id: user && !parsed.data.isAnonymous ? user.id : null,
      is_anonymous: parsed.data.isAnonymous || !user,
      section_slug: parent.section_slug,
      anchor_text: parent.anchor_text,
      body: parsed.data.body,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    logServerError("comments.reply", error);
    return apiError("UNEXPECTED", "Could not create reply.");
  }
  await embedVisibleComment(inserted.id).catch((embedError) => {
    logServerError("comments.reply.embed", embedError);
  });
  const comments = await listCommentsForPage(parent.page_id);
  return apiSuccess({ commentId: inserted.id, comments }, { status: 201 });
}
