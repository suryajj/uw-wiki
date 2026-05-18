import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import {
  ensureNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications/service";

const prefsLimiter = createRateLimiter(10, "1 m");

const prefsSchema = z.object({
  inAppPrStatus: z.boolean().optional(),
  emailPrStatus: z.boolean().optional(),
  inAppCommentReply: z.boolean().optional(),
  emailCommentReply: z.boolean().optional(),
  inAppPageUpdate: z.boolean().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in required.");
  try {
    const preferences = await ensureNotificationPreferences(user.id);
    return apiSuccess({ preferences });
  } catch (error) {
    logServerError("notifications.preferences.get", error);
    return apiError("UNEXPECTED", "Could not load notification preferences.");
  }
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in required.");
  const limit = await checkRateLimit(prefsLimiter, `notification-preferences:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const parsed = await parseJson(req, prefsSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const preferences = await updateNotificationPreferences(user.id, parsed.data);
    return apiSuccess({ preferences });
  } catch (error) {
    logServerError("notifications.preferences.put", error);
    return apiError("UNEXPECTED", "Could not update notification preferences.");
  }
}
