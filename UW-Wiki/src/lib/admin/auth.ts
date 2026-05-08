import "server-only";

import { apiError } from "@/lib/api/errors";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/current-user";

export async function requireAdminApi(): Promise<
  | { ok: true; user: CurrentUser }
  | { ok: false; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: apiError("UNAUTHORIZED", "Sign in required.") };
  if (user.role !== "admin") {
    return { ok: false, response: apiError("FORBIDDEN", "Admin access required.") };
  }
  return { ok: true, user };
}

export async function requireReviewerApi(): Promise<
  | { ok: true; user: CurrentUser }
  | { ok: false; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: apiError("UNAUTHORIZED", "Sign in required.") };
  if (user.role !== "reviewer" && user.role !== "admin") {
    return { ok: false, response: apiError("FORBIDDEN", "Reviewer access required.") };
  }
  return { ok: true, user };
}
