import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { markAllNotificationsRead } from "@/lib/notifications/service";

const markAllLimiter = createRateLimiter(10, "1 m");

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in required.");
  const limit = await checkRateLimit(markAllLimiter, `notifications:mark-all:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  try {
    await markAllNotificationsRead(user.id);
    return apiSuccess({ message: "All notifications marked read." });
  } catch (error) {
    logServerError("notifications.mark-all-read", error);
    return apiError("UNEXPECTED", "Could not mark notifications read.");
  }
}
