import { z } from "zod";

import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdminApi } from "@/lib/admin/auth";
import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const roleLimiter = createRateLimiter(30, "1 m");

type RouteCtx = { params: Promise<{ id: string }> };

const schema = z.object({ role: z.enum(["user", "reviewer", "admin"]) });

export async function POST(req: Request, { params }: RouteCtx) {
  const adminUser = await requireAdminApi();
  if (!adminUser.ok) return adminUser.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  const limit = await checkRateLimit(roleLimiter, `admin:users:role:${adminUser.user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  if (id === adminUser.user.id && parsed.data.role !== "admin") {
    return apiError("FORBIDDEN", "You cannot demote yourself.");
  }
  const admin = createAdminClient();
  const { error } = await admin.from("users").update({ role: parsed.data.role }).eq("id", id);
  if (error) {
    logServerError("admin.users.role", error);
    return apiError("UNEXPECTED", "Could not update role.");
  }
  await logAdminActivity({
    actorId: adminUser.user.id,
    action: "change_user_role",
    entityType: "user",
    entityId: id,
    summary: `Changed user role to ${parsed.data.role}`,
  });
  return apiSuccess({ message: "Role updated." });
}
