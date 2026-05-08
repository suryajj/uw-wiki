import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdminApi } from "@/lib/admin/auth";
import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteCtx = { params: Promise<{ id: string; orgId: string }> };

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const adminUser = await requireAdminApi();
  if (!adminUser.ok) return adminUser.response;
  const { id, orgId } = await params;
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_affiliations")
    .update({ is_active: false })
    .eq("user_id", id)
    .eq("org_id", orgId);
  if (error) {
    logServerError("admin.users.affiliations.revoke", error);
    return apiError("UNEXPECTED", "Could not revoke affiliation.");
  }
  await logAdminActivity({
    actorId: adminUser.user.id,
    action: "revoke_affiliation",
    entityType: "user",
    entityId: id,
    summary: "Revoked user affiliation",
    metadata: { org_id: orgId },
  });
  return apiSuccess({ message: "Affiliation revoked." });
}
