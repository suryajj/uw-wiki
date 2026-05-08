import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: "user" | "reviewer" | "admin";
};

/**
 * Resolve the currently signed-in user without redirecting. Returns null
 * for anonymous requests so anonymous-friendly endpoints can still proceed.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, role, email")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    displayName: profile?.display_name ?? null,
    role: (profile?.role as CurrentUser["role"]) ?? "user",
  };
}

export async function isAffiliatedWithOrg(
  userId: string,
  orgId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_affiliations")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();
  return !!data;
}
