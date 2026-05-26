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
import {
  ORG_IMAGES_BUCKET,
  mapOrgImage,
} from "@/lib/storage/org-images";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const moderationLimiter = createRateLimiter(60, "10 m");

const schema = z.object({
  action: z.enum(["accept", "reject"]),
  // Optional reason shown to the contributor when rejecting. Surfaced
  // later in notifications + the user's contributions surface (out of
  // scope for the initial cut).
  reason: z.string().trim().max(280).optional(),
});

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/org-images/[id]
 *
 * Admin-only. Flips a pending image to accepted or rejected. Accepted
 * rows become visible on the public wiki article on the next page load
 * (the wiki page resolves the latest accepted header image via
 * `getLatestHeaderImage`).
 *
 * Rejected rows are kept in the table — never displayed publicly — so we
 * have an audit trail of what was reviewed. The associated storage file
 * is removed on reject to free space.
 */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const adminUser = await requireAdminApi();
  if (!adminUser.ok) return adminUser.response;

  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;

  const { id } = await params;
  const limit = await checkRateLimit(
    moderationLimiter,
    `admin:org-images:${adminUser.user.id}`,
  );
  if (!limit.success) {
    return apiError("RATE_LIMITED", "Too many actions — slow down for a moment.");
  }

  const admin = createAdminClient();
  const { data: image, error: lookupError } = await admin
    .from("org_images")
    .select(
      "id, org_id, kind, status, storage_path, alt, caption, uploaded_by, decided_by, decided_at, rejection_reason, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (lookupError) {
    logServerError("admin.org-images.lookup", lookupError);
    return apiError("UNEXPECTED", "Could not load image.");
  }
  if (!image) return apiError("NOT_FOUND", "Image not found.");
  if (image.status !== "pending") {
    return apiError(
      "INVALID_STATE",
      `Cannot moderate image in state '${image.status}'.`,
    );
  }

  const newStatus = parsed.data.action === "accept" ? "accepted" : "rejected";
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("org_images")
    .update({
      status: newStatus,
      decided_by: adminUser.user.id,
      decided_at: now,
      rejection_reason: newStatus === "rejected" ? parsed.data.reason ?? null : null,
      updated_at: now,
    })
    .eq("id", id)
    .select(
      "id, org_id, kind, status, storage_path, alt, caption, uploaded_by, decided_by, decided_at, rejection_reason, created_at",
    )
    .maybeSingle();
  if (updateError || !updated) {
    logServerError("admin.org-images.update", updateError);
    return apiError("UNEXPECTED", "Could not update image status.");
  }

  // Free up storage on reject. Keep the row (audit trail) but the file
  // itself has no reason to live in the bucket once it's rejected.
  if (newStatus === "rejected") {
    const { error: removeError } = await admin.storage
      .from(ORG_IMAGES_BUCKET)
      .remove([image.storage_path]);
    if (removeError) {
      // Log but don't fail — the row is already updated, the file leak
      // is recoverable via a sweep job. We do NOT want to roll back the
      // moderation decision on storage hiccups.
      logServerError("admin.org-images.remove", removeError);
    }
  }

  await logAdminActivity({
    actorId: adminUser.user.id,
    action: newStatus === "accepted" ? "accept_org_image" : "reject_org_image",
    entityType: "org_image",
    entityId: id,
    summary:
      newStatus === "accepted"
        ? "Accepted org image"
        : "Rejected org image",
    metadata: {
      org_id: image.org_id,
      kind: image.kind,
      reason: parsed.data.reason ?? null,
    },
  });

  return apiSuccess({ image: mapOrgImage(updated) });
}
