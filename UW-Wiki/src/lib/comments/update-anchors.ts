import "server-only";

import { pageTextFromDoc, reanchor } from "@/lib/comments/anchoring";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProseMirrorDoc } from "@/types/domain";

/**
 * Recompute anchor status for every top-level comment on a page after a
 * proposal accept. Replies inherit the parent's status because they share
 * the parent's anchor text (FRD-3 §3.4 + §13.3).
 */
export async function updateAnchorStatusForPage(
  pageId: string,
  contentJson: ProseMirrorDoc,
) {
  const admin = createAdminClient();
  const pageText = pageTextFromDoc(contentJson);

  const { data: comments } = await admin
    .from("comments")
    .select("id,anchor_text,parent_comment_id")
    .eq("page_id", pageId)
    .eq("is_hidden", false);

  const list = comments ?? [];
  const parentStatus = new Map<string, boolean>();

  for (const comment of list) {
    if (comment.parent_comment_id !== null) continue;
    const result = reanchor(comment.anchor_text ?? "", pageText);
    parentStatus.set(comment.id, result.isAnchored);
    await admin
      .from("comments")
      .update({ is_anchored: result.isAnchored })
      .eq("id", comment.id);
    await admin
      .from("chunks")
      .update({ references_previous_version: !result.isAnchored })
      .eq("source_comment_id", comment.id);
  }

  for (const comment of list) {
    const parentId = comment.parent_comment_id;
    if (parentId === null) continue;
    const parentAnchored = parentStatus.get(parentId);
    if (parentAnchored === undefined) continue;
    await admin
      .from("comments")
      .update({ is_anchored: parentAnchored })
      .eq("id", comment.id);
    await admin
      .from("chunks")
      .update({ references_previous_version: !parentAnchored })
      .eq("source_comment_id", comment.id);
  }
}
