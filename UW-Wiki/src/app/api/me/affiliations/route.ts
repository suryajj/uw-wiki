import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const addLimiter = createRateLimiter(10, "1 h");

const addSchema = z.object({
  orgId: z.string().uuid(),
  roleLabel: z.string().trim().max(80).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to view affiliations.");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_affiliations")
    .select("id,role_label,is_active,created_at,organizations(id,org_name,org_slug,category)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) {
    logServerError("me.affiliations.list", error);
    return apiError("UNEXPECTED", "Could not load affiliations.");
  }
  return apiSuccess({ affiliations: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to add affiliations.");
  const parsed = await parseJson(req, addSchema);
  if (!parsed.ok) return parsed.response;

  const limit = await checkRateLimit(addLimiter, `affiliations:add:${user.id}`);
  if (!limit.success) {
    return apiError("RATE_LIMITED", "Too many affiliation changes. Try later.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("user_affiliations").upsert(
    {
      user_id: user.id,
      org_id: parsed.data.orgId,
      role_label: parsed.data.roleLabel ?? null,
      is_active: true,
    },
    { onConflict: "user_id,org_id" },
  );
  if (error) {
    logServerError("me.affiliations.add", error);
    return apiError("UNEXPECTED", "Could not add affiliation.");
  }
  return apiSuccess({ message: "Affiliation added." }, { status: 201 });
}
