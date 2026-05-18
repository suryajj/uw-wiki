import { z } from "zod";

import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdminApi } from "@/lib/admin/auth";
import {
  apiError,
  apiSuccess,
  logServerError,
  parseJson,
} from "@/lib/api/errors";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const metadataLimiter = createRateLimiter(30, "10 m");

// Updatable metadata fields on `organizations`. The slug + category live on
// other admin surfaces (cold-start, schema migration) — kept out of this
// route to avoid accidental URL/category churn.
const schema = z.object({
  orgName: z.string().trim().min(1).max(200).optional(),
  tagline: z.string().trim().max(280).nullable().optional(),
});

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/orgs/[id]
 *
 * Admin-only inline edit for an org's display metadata (the H1 title that
 * appears on the wiki page and the tagline shown in directory cards).
 * Pure metadata — does NOT touch the article body / page_versions.
 */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const adminUser = await requireAdminApi();
  if (!adminUser.ok) return adminUser.response;

  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;

  const { id } = await params;
  const limit = await checkRateLimit(
    metadataLimiter,
    `admin:org-metadata:${adminUser.user.id}`,
  );
  if (!limit.success) {
    return apiError("RATE_LIMITED", "Too many edits — slow down for a moment.");
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.orgName !== undefined) updates.org_name = parsed.data.orgName;
  if (parsed.data.tagline !== undefined) {
    // Empty string is treated as "clear the tagline" — store null so the
    // empty-state fallback ("No tagline yet.") shows in cards.
    updates.tagline =
      parsed.data.tagline === null || parsed.data.tagline === ""
        ? null
        : parsed.data.tagline;
  }
  if (Object.keys(updates).length === 0) {
    return apiError("VALIDATION_FAILED", "No fields to update.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .update(updates)
    .eq("id", id)
    .select("id, org_slug, org_name, tagline")
    .maybeSingle();
  if (error) {
    logServerError("admin.org.metadata.update", error);
    return apiError("UNEXPECTED", "Could not update org metadata.");
  }
  if (!data) return apiError("NOT_FOUND", "Organization not found.");

  await logAdminActivity({
    actorId: adminUser.user.id,
    action: "update_org_metadata",
    entityType: "organization",
    entityId: id,
    summary: `Edited metadata: ${Object.keys(updates).join(", ")}`,
    metadata: { fields: Object.keys(updates) },
  });

  return apiSuccess({
    org: {
      id: data.id,
      orgSlug: data.org_slug,
      orgName: data.org_name,
      tagline: data.tagline,
    },
  });
}
