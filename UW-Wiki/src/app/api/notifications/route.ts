import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listNotifications } from "@/lib/notifications/service";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in required.");
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("tab") === "unread";
  try {
    const notifications = await listNotifications(user.id, unreadOnly);
    return apiSuccess({ notifications });
  } catch (error) {
    logServerError("notifications.list", error);
    return apiError("UNEXPECTED", "Could not load notifications.");
  }
}
