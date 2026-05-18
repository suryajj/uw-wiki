import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { markNotificationRead } from "@/lib/notifications/service";

const markReadLimiter = createRateLimiter(30, "1 m");

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in required.");
  const { id } = await params;
  const limit = await checkRateLimit(markReadLimiter, `notifications:mark-read:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  try {
    await markNotificationRead(user.id, id);
    return apiSuccess({ message: "Notification marked read." });
  } catch (error) {
    logServerError("notifications.mark-read", error);
    return apiError("UNEXPECTED", "Could not mark notification read.");
  }
}
