import "server-only";

import { apiError } from "@/lib/api/errors";
import {
  checkRateLimitChain,
  createDailyRateLimiter,
  createRateLimiter,
  hashClientIp,
  retryAfterSeconds,
} from "@/lib/rate-limit";
import type { CurrentUser } from "@/lib/auth/current-user";

// FRD-3 §12.5
const anonymousBurst = createRateLimiter(1, "10 s");
const anonymousDaily = createDailyRateLimiter(20);
const authenticatedBurst = createRateLimiter(1, "5 s");
const authenticatedDaily = createDailyRateLimiter(50);

const BURST_COPY = "You're posting too quickly — please wait a moment.";
const DAILY_COPY = "You've reached the daily comment limit. Try again tomorrow.";

export async function enforceCommentRateLimits(
  req: Request,
  user: CurrentUser | null,
): Promise<Response | null> {
  const ip = hashClientIp(req);
  const burst = user ? authenticatedBurst : anonymousBurst;
  const daily = user ? authenticatedDaily : anonymousDaily;
  const burstId = user ? `comment:burst:user:${user.id}` : `comment:burst:ip:${ip}`;
  const dailyId = user ? `comment:daily:user:${user.id}` : `comment:daily:ip:${ip}`;
  const result = await checkRateLimitChain([
    { limiter: burst, identifier: burstId, label: "burst" },
    { limiter: daily, identifier: dailyId, label: "daily" },
  ]);
  if (result.success) return null;
  const retryAfter = retryAfterSeconds(result.result.reset).toString();
  const message = result.label === "daily" ? DAILY_COPY : BURST_COPY;
  return apiError("RATE_LIMITED", message, {
    headers: { "Retry-After": retryAfter },
  });
}
