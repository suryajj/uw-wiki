import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const removeAffiliationLimiter = createRateLimiter(10, "1 h");

type RouteCtx = { params: Promise<{ orgId: string }> };

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to remove affiliations.");
  const { orgId } = await params;
  const limit = await checkRateLimit(removeAffiliationLimiter, `affiliations:remove:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_affiliations")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("org_id", orgId);
  if (error) {
    logServerError("me.affiliations.remove", error);
    return apiError("UNEXPECTED", "Could not remove affiliation.");
  }
  return apiSuccess({ message: "Affiliation removed." });
}
