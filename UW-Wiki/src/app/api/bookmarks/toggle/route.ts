import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const toggleSchema = z.object({
  pageId: z.string().uuid(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to bookmark pages.");

  const parsed = await parseJson(req, toggleSchema);
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("bookmarks")
    .select("page_id")
    .eq("user_id", user.id)
    .eq("page_id", parsed.data.pageId)
    .maybeSingle();

  if (readError) {
    logServerError("bookmarks.toggle.read", readError);
    return apiError("UNEXPECTED", "Could not read bookmark.");
  }

  if (existing) {
    const { error } = await admin
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("page_id", parsed.data.pageId);
    if (error) {
      logServerError("bookmarks.toggle.delete", error);
      return apiError("UNEXPECTED", "Could not remove bookmark.");
    }
    return apiSuccess({ bookmarked: false });
  }

  const { error } = await admin.from("bookmarks").insert({
    user_id: user.id,
    page_id: parsed.data.pageId,
  });
  if (error) {
    logServerError("bookmarks.toggle.insert", error);
    return apiError("UNEXPECTED", "Could not save bookmark.");
  }

  return apiSuccess({ bookmarked: true });
}
