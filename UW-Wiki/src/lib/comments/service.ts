import "server-only";

import { reembedComment } from "@/lib/ai/embeddings";
import { pageTextFromDoc, reanchor } from "@/lib/comments/anchoring";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CommentTree, OrgMeta, ProseMirrorDoc } from "@/types/domain";

type CommentDbRow = {
  id: string;
  page_id: string;
  parent_comment_id: string | null;
  author_id: string | null;
  is_anonymous: boolean;
  is_edited: boolean;
  is_hidden: boolean;
  section_slug: string | null;
  anchor_text: string | null;
  body: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
  is_anchored: boolean | null;
  users?: { display_name: string | null } | null;
};

export async function listCommentsForPage(pageId: string): Promise<CommentTree[]> {
  const admin = createAdminClient();
  const [{ data: pageRow }, { data: commentsData, error }] = await Promise.all([
    admin.from("pages").select("content_json,current_version_id").eq("id", pageId).maybeSingle(),
    admin
      .from("comments")
      .select(
        "id,page_id,parent_comment_id,author_id,is_anonymous,is_edited,is_hidden,section_slug,anchor_text,body,upvotes,downvotes,created_at,updated_at,is_anchored,users!comments_author_id_fkey(display_name)",
      )
      .eq("page_id", pageId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: true }),
  ]);
  if (error) throw error;

  const rows = ((commentsData ?? []) as unknown as CommentDbRow[]).map(mapCommentRow);

  // Recompute is_anchored against the current page text. We persist
  // changes back so subsequent loads do not pay this cost (FRD-3 §17 #9/#10).
  const pageText = pageRow?.content_json
    ? pageTextFromDoc(pageRow.content_json as ProseMirrorDoc)
    : "";
  const updates: Array<{ id: string; isAnchored: boolean }> = [];
  for (const row of rows) {
    if (row.parentCommentId !== null) continue;
    const result = reanchor(row.anchorText, pageText);
    const next = result.isAnchored;
    if (row.isAnchored !== next) {
      updates.push({ id: row.id, isAnchored: next });
      row.isAnchored = next;
    }
  }
  if (updates.length > 0) {
    // Best-effort persistence; failures surface in logs only.
    await Promise.all(
      updates.map((update) =>
        admin
          .from("comments")
          .update({ is_anchored: update.isAnchored })
          .eq("id", update.id),
      ),
    ).catch(() => undefined);
  }

  const replyIsAnchored = new Map<string, boolean>();
  for (const row of rows) {
    if (row.parentCommentId === null) replyIsAnchored.set(row.id, row.isAnchored);
  }
  for (const row of rows) {
    if (row.parentCommentId === null) continue;
    row.isAnchored = replyIsAnchored.get(row.parentCommentId) ?? row.isAnchored;
  }

  const topLevel = rows.filter((row) => row.parentCommentId === null);
  const replies = rows.filter((row) => row.parentCommentId !== null);
  return topLevel.map((comment) => ({
    ...comment,
    replies: replies.filter((reply) => reply.parentCommentId === comment.id),
  }));
}

export async function getOrgMetaForPage(pageId: string): Promise<OrgMeta | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pages")
    .select(
      "id,current_version_id,organizations(id,university_id,org_name,org_slug,category)",
    )
    .eq("id", pageId)
    .maybeSingle();
  if (!data) return null;
  const rawOrg = data.organizations as
    | {
        id: string;
        university_id: string;
        org_name: string;
        org_slug: string;
        category: string;
      }
    | Array<{
        id: string;
        university_id: string;
        org_name: string;
        org_slug: string;
        category: string;
      }>;
  const org = Array.isArray(rawOrg) ? rawOrg[0] : rawOrg;
  if (!org) return null;
  return {
    universityId: org.university_id,
    orgId: org.id,
    orgName: org.org_name,
    orgSlug: org.org_slug,
    category: org.category,
    pageVersionId: data.current_version_id,
  };
}

export async function embedVisibleComment(commentId: string) {
  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("comments")
    .select("page_id,body,section_slug,created_at,is_hidden")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment || comment.is_hidden) return;
  const orgMeta = await getOrgMetaForPage(comment.page_id);
  if (!orgMeta) return;
  await reembedComment(commentId, orgMeta, {
    body: comment.body,
    anchoredSection: comment.section_slug,
    createdAt: comment.created_at,
    referencesPreviousVersion: false,
  });
}

export async function deleteCommentChunk(commentId: string) {
  const admin = createAdminClient();
  await admin.from("chunks").delete().eq("source_comment_id", commentId);
}

function mapCommentRow(row: CommentDbRow): Omit<CommentTree, "replies"> {
  return {
    id: row.id,
    pageId: row.page_id,
    parentCommentId: row.parent_comment_id,
    authorId: row.author_id,
    isAnonymous: row.is_anonymous,
    isEdited: row.is_edited,
    isHidden: row.is_hidden,
    sectionSlug: row.section_slug ?? "unknown",
    anchorText: row.anchor_text ?? "",
    body: row.body,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorDisplayName: row.is_anonymous ? null : displayName(row.users),
    isAnchored: row.is_anchored ?? true,
  };
}

function displayName(
  users: CommentDbRow["users"] | CommentDbRow["users"][],
): string | null {
  const user = Array.isArray(users) ? users[0] : users;
  return user?.display_name ?? null;
}
