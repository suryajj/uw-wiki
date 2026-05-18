import { z } from "zod";

import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdminApi } from "@/lib/admin/auth";
import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_CATEGORIES } from "@/types/domain";

const lifecycleLimiter = createRateLimiter(10, "1 h");

const rowSchema = z.object({
  category: z.enum(ORG_CATEGORIES),
  needsUpdateMonths: z.number().int().min(1).max(120),
  staleMonths: z.number().int().min(1).max(120),
  defunctMonths: z.number().int().min(1).max(120),
});

const schema = z.object({ rows: z.array(rowSchema).min(1) });

export async function POST(req: Request) {
  const adminUser = await requireAdminApi();
  if (!adminUser.ok) return adminUser.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const limit = await checkRateLimit(lifecycleLimiter, `admin:lifecycle:${adminUser.user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  for (const row of parsed.data.rows) {
    if (row.needsUpdateMonths >= row.staleMonths || row.staleMonths >= row.defunctMonths) {
      return apiError("VALIDATION_FAILED", "Thresholds must be needs-update < stale < defunct.");
    }
  }
  const admin = createAdminClient();
  for (const row of parsed.data.rows) {
    const { error } = await admin
      .from("lifecycle_config")
      .update({
        needs_update_days: row.needsUpdateMonths * 30,
        stale_days: row.staleMonths * 30,
        defunct_days: row.defunctMonths * 30,
        updated_at: new Date().toISOString(),
      })
      .eq("category", row.category);
    if (error) {
      logServerError("admin.lifecycle.update", error);
      return apiError("UNEXPECTED", "Could not update lifecycle config.");
    }
    await logAdminActivity({
      actorId: adminUser.user.id,
      action: "update_lifecycle",
      entityType: "lifecycle_config",
      summary: `Updated lifecycle threshold for ${row.category}`,
      metadata: row,
    });
  }
  return apiSuccess({ message: "Lifecycle config updated." });
}
