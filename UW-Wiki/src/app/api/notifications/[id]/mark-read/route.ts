import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { markNotificationRead } from "@/lib/notifications/service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in required.");
  const { id } = await params;
  try {
    await markNotificationRead(user.id, id);
    return apiSuccess({ message: "Notification marked read." });
  } catch (error) {
    logServerError("notifications.mark-read", error);
    return apiError("UNEXPECTED", "Could not mark notification read.");
  }
}
