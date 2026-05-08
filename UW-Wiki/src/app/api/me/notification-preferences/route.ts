import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  ensureNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications/service";

const prefsSchema = z.object({
  inAppPrStatus: z.boolean().optional(),
  emailPrStatus: z.boolean().optional(),
  inAppCommentReply: z.boolean().optional(),
  emailCommentReply: z.boolean().optional(),
  inAppPageUpdate: z.boolean().optional(),
  emailPageUpdateDigest: z.boolean().optional(),
  pageUpdateDigestFrequency: z.enum(["daily", "weekly", "never"]).optional(),
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
