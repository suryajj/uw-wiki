import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { unreadNotificationCount } from "@/lib/notifications/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiSuccess({ count: 0 });
  try {
    const count = await unreadNotificationCount(user.id);
    return apiSuccess({ count });
  } catch (error) {
    logServerError("notifications.unread-count", error);
    return apiError("UNEXPECTED", "Could not load unread count.");
  }
}
