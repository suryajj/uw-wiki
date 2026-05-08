import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { setBookmarkState } from "@/lib/actions/bookmarks";
import { getCurrentUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

const toggleSchema = z.object({
  pageId: z.string().uuid().optional(),
  page_id: z.string().uuid().optional(),
  desiredState: z.enum(["bookmarked", "unbookmarked"]).optional(),
  desired_state: z.enum(["bookmarked", "unbookmarked"]).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to bookmark pages.");

  const parsed = await parseJson(req, toggleSchema);
  if (!parsed.ok) return parsed.response;
  const pageId = parsed.data.page_id ?? parsed.data.pageId;
  const desiredState = parsed.data.desired_state ?? parsed.data.desiredState ?? "bookmarked";
  if (!pageId) {
    return apiError("VALIDATION_FAILED", "page_id is required.");
  }

  try {
    const result = await setBookmarkState({ userId: user.id, pageId, desiredState });
    if (!result.ok) return apiError("NOT_FOUND", "Page not found.");
    return apiSuccess({ state: result.state, bookmarked: result.state === "bookmarked" });
  } catch (error) {
    logServerError("bookmarks.toggle", error);
    return apiError("UNEXPECTED", "Could not update bookmark.");
  }
}
