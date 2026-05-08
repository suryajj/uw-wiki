import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { markAllNotificationsRead } from "@/lib/notifications/service";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in required.");
  try {
    await markAllNotificationsRead(user.id);
    return apiSuccess({ message: "All notifications marked read." });
  } catch (error) {
    logServerError("notifications.mark-all-read", error);
    return apiError("UNEXPECTED", "Could not mark notifications read.");
  }
}
