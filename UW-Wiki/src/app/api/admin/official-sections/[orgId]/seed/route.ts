import { z } from "zod";

import { reembedSections } from "@/lib/ai/embeddings";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdminApi } from "@/lib/admin/auth";
import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { updateAnchorStatusForPage } from "@/lib/comments/update-anchors";
import { extractSections } from "@/lib/prosemirror/sections";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slug";
import type { ProseMirrorDoc, ProseMirrorNode } from "@/types/domain";

type RouteCtx = { params: Promise<{ orgId: string }> };

const schema = z.object({
  title: z.string().trim().min(2).max(80).default("Official"),
  body: z.string().trim().min(1).max(4000),
  summary: z.string().trim().max(300).optional(),
});

export async function POST(req: Request, { params }: RouteCtx) {
  const adminUser = await requireAdminApi();
  if (!adminUser.ok) return adminUser.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { orgId } = await params;
  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id,content_json,current_version_id,organizations(id,university_id,org_name,org_slug,category)")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!page) return apiError("NOT_FOUND", "Page not found.");
  const org = Array.isArray(page.organizations)
    ? page.organizations[0]
    : page.organizations;
  if (!org) return apiError("NOT_FOUND", "Organization not found.");

  const currentDoc = (page.content_json ?? { type: "doc", content: [] }) as ProseMirrorDoc;
  const slug = "official";
  const officialNodes: ProseMirrorNode[] = [
    {
      type: "heading",
      attrs: { level: 2, slug, official: true },
      content: [{ type: "text", text: parsed.data.title }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: parsed.data.body }],
    },
  ];
  const content = [...(currentDoc.content ?? [])];
  const existing = content.findIndex(
    (node) => node.type === "heading" && node.attrs?.slug === slug,
  );
  if (existing >= 0) {
    const nextH2 = content.findIndex(
      (node, index) =>
        index > existing && node.type === "heading" && node.attrs?.level === 2,
    );
    content.splice(existing, (nextH2 === -1 ? content.length : nextH2) - existing, ...officialNodes);
  } else {
    const sections = extractSections(currentDoc);
    const overview = sections.find((section) => section.slug === "overview");
    const insertAt = overview ? overview.endIndex : 0;
    content.splice(insertAt, 0, ...officialNodes);
  }
  const newDoc: ProseMirrorDoc = { type: "doc", content };

  const { data: versions } = await admin
    .from("page_versions")
    .select("version_number")
    .eq("page_id", page.id);
  const nextVersion =
    Math.max(0, ...((versions ?? []).map((row) => row.version_number ?? 0))) + 1;
  const { data: version, error: versionError } = await admin
    .from("page_versions")
    .insert({
      page_id: page.id,
      content_json: newDoc,
      is_current: true,
      is_anonymous: false,
      is_admin_seeded: true,
      author_id: adminUser.user.id,
      edit_summary: parsed.data.summary ?? "Seed Official section",
      summary: parsed.data.summary ?? "Seed Official section",
      version_number: nextVersion,
    })
    .select("id")
    .single();
  if (versionError || !version) {
    logServerError("admin.official.seed.version", versionError);
    return apiError("UNEXPECTED", "Could not create page version.");
  }
  await admin.from("page_versions").update({ is_current: false }).eq("page_id", page.id).neq("id", version.id);
  await admin
    .from("pages")
    .update({
      current_version_id: version.id,
      content_json: newDoc,
      last_modified_at: new Date().toISOString(),
    })
    .eq("id", page.id);
  await reembedSections(
    page.id,
    [slug],
    {
      universityId: org.university_id,
      orgId: org.id,
      orgName: org.org_name,
      orgSlug: org.org_slug,
      category: org.category,
      pageVersionId: version.id,
    },
    newDoc,
  ).catch((error) => logServerError("admin.official.seed.reembed", error));
  await updateAnchorStatusForPage(page.id, newDoc).catch((error) =>
    logServerError("admin.official.seed.reanchor", error),
  );
  await logAdminActivity({
    actorId: adminUser.user.id,
    action: "seed_official_section",
    entityType: "organization",
    entityId: orgId,
    summary: `Seeded Official section for ${org.org_name}`,
    metadata: { page_id: page.id, version_id: version.id, section_slug: slugify(parsed.data.title) },
  });
  return apiSuccess({ pageId: page.id, versionId: version.id });
}
