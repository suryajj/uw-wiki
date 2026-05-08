import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { enforceCommentRateLimits } from "@/lib/comments/rate-limits";
import { embedVisibleComment, listCommentsForPage } from "@/lib/comments/service";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const createCommentSchema = z.object({
  pageId: z.string().uuid(),
  body: z.string().trim().min(1).max(1500),
  anchorText: z.string().trim().max(500).default(""),
  sectionSlug: z.string().trim().min(1).default("unknown"),
  isAnonymous: z.boolean().default(true),
  parentCommentId: z.string().uuid().nullable().optional(),
});

export async function GET(req: Request) {
  const pageId = new URL(req.url).searchParams.get("pageId");
  if (!pageId) return apiError("VALIDATION_FAILED", "pageId is required.");
  const comments = await listCommentsForPage(pageId);
  return apiSuccess({ comments });
}

export async function POST(req: Request) {
  const parsed = await parseJson(req, createCommentSchema);
  if (!parsed.ok) return parsed.response;

  const user = await getCurrentUser();
  const rateResponse = await enforceCommentRateLimits(req, user);
  if (rateResponse) return rateResponse;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("comments")
    .insert({
      page_id: parsed.data.pageId,
      parent_comment_id: parsed.data.parentCommentId ?? null,
      author_id: user && !parsed.data.isAnonymous ? user.id : null,
      is_anonymous: parsed.data.isAnonymous || !user,
      anchor_text: parsed.data.anchorText,
      section_slug: parsed.data.sectionSlug,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    logServerError("comments.create", error);
    return apiError("UNEXPECTED", "Could not create comment.");
  }

  await embedVisibleComment(inserted.id).catch((embedError) => {
    logServerError("comments.embed", embedError);
  });

  const comments = await listCommentsForPage(parsed.data.pageId);
  return apiSuccess({ commentId: inserted.id, comments }, { status: 201 });
}
