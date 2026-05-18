import { z } from "zod";

import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdminApi } from "@/lib/admin/auth";
import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const adminAffiliationLimiter = createRateLimiter(30, "1 m");

type RouteCtx = { params: Promise<{ id: string }> };

const schema = z.object({
  orgId: z.string().uuid(),
  roleLabel: z.string().trim().max(80).optional(),
});

export async function POST(req: Request, { params }: RouteCtx) {
  const adminUser = await requireAdminApi();
  if (!adminUser.ok) return adminUser.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  const limit = await checkRateLimit(adminAffiliationLimiter, `admin:affiliations:${adminUser.user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const admin = createAdminClient();
  const { error } = await admin.from("user_affiliations").upsert(
    {
      user_id: id,
      org_id: parsed.data.orgId,
      role_label: parsed.data.roleLabel ?? null,
      is_active: true,
    },
    { onConflict: "user_id,org_id" },
  );
  if (error) {
    logServerError("admin.users.affiliations.add", error);
    return apiError("UNEXPECTED", "Could not add affiliation.");
  }
  await logAdminActivity({
    actorId: adminUser.user.id,
    action: "add_affiliation",
    entityType: "user",
    entityId: id,
    summary: "Added user affiliation",
    metadata: { org_id: parsed.data.orgId },
  });
  return apiSuccess({ message: "Affiliation added." });
}
