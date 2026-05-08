import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type BookmarkState = "bookmarked" | "unbookmarked";

export async function setBookmarkState(input: {
  userId: string;
  pageId: string;
  desiredState: BookmarkState;
}) {
  const admin = createAdminClient();
  const { data: page, error: pageError } = await admin
    .from("pages")
    .select("id")
    .eq("id", input.pageId)
    .maybeSingle();
  if (pageError) throw pageError;
  if (!page) {
    return { ok: false as const, reason: "PAGE_NOT_FOUND" as const };
  }

  if (input.desiredState === "bookmarked") {
    const { error } = await admin.from("bookmarks").upsert(
      {
        user_id: input.userId,
        page_id: input.pageId,
      },
      { onConflict: "user_id,page_id" },
    );
    if (error) throw error;
    return { ok: true as const, state: "bookmarked" as const };
  }

  const { error } = await admin
    .from("bookmarks")
    .delete()
    .eq("user_id", input.userId)
    .eq("page_id", input.pageId);
  if (error) throw error;
  return { ok: true as const, state: "unbookmarked" as const };
}

export async function getBookmarkState(userId: string | null, pageId: string) {
  if (!userId) return "unbookmarked" as const;
  const admin = createAdminClient();
  const { data } = await admin
    .from("bookmarks")
    .select("page_id")
    .eq("user_id", userId)
    .eq("page_id", pageId)
    .maybeSingle();
  return data ? "bookmarked" : "unbookmarked";
}
